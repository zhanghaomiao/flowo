import { useEffect, useMemo, useRef, useState } from 'react';

import { Query, QueryClient, useQueryClient } from '@tanstack/react-query';
import debounce from 'lodash/debounce';

import { client } from '@/client/client.gen';
import { getSseTicket } from '@/client/sdk.gen';

const TAG_WORKFLOWS = 'workflow';

const invalidateByTag = (queryClient: QueryClient, tag: string) => {
  return queryClient.invalidateQueries({
    predicate: (query: Query) => {
      const keyObj = query.queryKey[0] as { tags?: string[] };
      return Array.isArray(keyObj?.tags) && keyObj.tags.includes(tag);
    },
  });
};

const SSE_BLOCK_SEPARATORS = ['\r\n\r\n', '\n\n', '\r\r'] as const;

type ConnectionStatus = 'OFF' | 'CONNECTING' | 'ONLINE' | 'ERROR';

/** Parse complete SSE blocks from a buffer; leave remainder for the next chunk. */
export function drainSseBlocks(buffer: string): {
  rest: string;
  blocks: string[];
} {
  const blocks: string[] = [];
  let working = buffer;

  while (working) {
    let nextIdx = -1;
    let nextSeparator = '';

    for (const separator of SSE_BLOCK_SEPARATORS) {
      const idx = working.indexOf(separator);
      if (idx !== -1 && (nextIdx === -1 || idx < nextIdx)) {
        nextIdx = idx;
        nextSeparator = separator;
      }
    }

    if (nextIdx === -1) {
      break;
    }

    const raw = working.slice(0, nextIdx);
    working = working.slice(nextIdx + nextSeparator.length);
    if (raw.trim()) {
      blocks.push(raw);
    }
  }

  return { rest: working, blocks };
}

export function parseSseBlock(raw: string): { event?: string; data?: string } {
  let event: string | undefined;
  const dataLines: string[] = [];
  const normalized = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  for (const line of normalized.split('\n')) {
    if (!line || line.startsWith(':')) {
      continue;
    }
    if (line.startsWith('event:')) {
      event = line.slice(6).trimStart();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  return { event, data: dataLines.length ? dataLines.join('\n') : undefined };
}

async function consumeSseOverFetch(
  url: string,
  ticket: string,
  signal: AbortSignal,
  onMessageData: (data: unknown) => void,
  onOpen?: () => void,
): Promise<void> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${ticket}` },
    credentials: 'include',
    signal,
  });
  if (!res.ok) {
    throw new Error(`SSE HTTP ${res.status}`);
  }
  onOpen?.();
  const reader = res.body?.getReader();
  if (!reader) {
    throw new Error('SSE response has no body');
  }
  const decoder = new TextDecoder();
  let buffer = '';
  while (!signal.aborted) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    buffer += decoder.decode(value, { stream: true });
    const { rest, blocks } = drainSseBlocks(buffer);
    buffer = rest;
    for (const block of blocks) {
      const { event, data } = parseSseBlock(block);
      if (event === 'message' && data) {
        try {
          onMessageData(JSON.parse(data));
        } catch (error) {
          console.warn('Malformed SSE message payload:', error, data);
        }
      }
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    const { event, data } = parseSseBlock(buffer);
    if (event === 'message' && data) {
      try {
        onMessageData(JSON.parse(data));
      } catch (error) {
        console.warn('Malformed trailing SSE message payload:', error, data);
      }
    }
  }
}

export const useWorkflowRealtime = (workflows: string[] = []) => {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>('OFF');

  const currentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentIdsRef.current = new Set(workflows);
  }, [workflows]);

  const debounceSync = useMemo(
    () =>
      debounce(
        () => {
          invalidateByTag(queryClient, TAG_WORKFLOWS);
        },
        1000,
        {
          leading: false,
          trailing: true,
          maxWait: 2000,
        },
      ),
    [queryClient],
  );

  useEffect(() => {
    const controller = new AbortController();
    let retryTimeout: NodeJS.Timeout | null = null;
    let isActive = true;

    const connectSse = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setConnectionStatus('OFF');
        return;
      }

      setConnectionStatus('CONNECTING');

      try {
        const ticketRes = await getSseTicket({
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (ticketRes.error) {
          throw new Error('Failed to obtain SSE ticket');
        }

        const { ticket } = ticketRes.data as { ticket: string };

        if (!isActive) {
          return;
        }

        const url = client.buildUrl({ url: '/api/v1/sse/events' });

        const onData = (data: unknown) => {
          if (!isActive) {
            return;
          }
          try {
            const row = data as {
              operation?: string;
              new_status?: unknown;
              table?: string;
              id?: string;
              workflow_id?: string;
            };
            if (row.operation === 'INSERT' || row.operation === 'DELETE') {
              debounceSync();
            }
            if (row.table === 'workflows') {
              if (row.id && currentIdsRef.current.has(row.id)) {
                debounceSync();
              } else if (
                row.workflow_id &&
                currentIdsRef.current.has(row.workflow_id)
              ) {
                debounceSync();
              }
            } else if (row.table === 'jobs') {
              if (
                row.workflow_id &&
                currentIdsRef.current.has(row.workflow_id)
              ) {
                debounceSync();
              }
            }
          } catch (e) {
            console.error('SSE handler error', e);
          }
        };

        const onOpen = () => {
          if (isActive) {
            setConnectionStatus('ONLINE');
            invalidateByTag(queryClient, TAG_WORKFLOWS);
          }
        };

        await consumeSseOverFetch(
          url,
          ticket,
          controller.signal,
          onData,
          onOpen,
        );

        if (isActive && !controller.signal.aborted) {
          setConnectionStatus('ERROR');
          retryTimeout = setTimeout(() => {
            void connectSse();
          }, 3000);
        }
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }
        console.error('SSE Connection Error:', error);
        if (isActive) {
          setConnectionStatus('ERROR');
          retryTimeout = setTimeout(() => {
            void connectSse();
          }, 5000);
        }
      }
    };

    void connectSse();

    return () => {
      isActive = false;
      controller.abort();
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      debounceSync.cancel();
    };
  }, [queryClient, debounceSync]);
  return connectionStatus;
};
