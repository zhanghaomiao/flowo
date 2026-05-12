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

/** Parse complete SSE blocks (``\\n\\n``) from a buffer; leave remainder for the next chunk. */
function drainSseBlocks(buffer: string): { rest: string; blocks: string[] } {
  const blocks: string[] = [];
  let working = buffer;
  let idx: number;
  while ((idx = working.indexOf('\n\n')) !== -1) {
    const raw = working.slice(0, idx);
    working = working.slice(idx + 2);
    if (raw.trim()) {
      blocks.push(raw);
    }
  }
  return { rest: working, blocks };
}

function parseSseBlock(raw: string): { event?: string; data?: string } {
  let event: string | undefined;
  const dataLines: string[] = [];
  for (const line of raw.split('\n')) {
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
        } catch {
          /* ignore malformed payloads */
        }
      }
    }
  }
}

export const useWorkflowRealtime = (workflows: string[] = []) => {
  const queryClient = useQueryClient();
  const [connectionStatus, setConnectionStatus] = useState<
    'OFF' | 'CONNECTING' | 'ONLINE'
  >('OFF');

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
            if (row.operation === 'UPDATE' && !row.new_status) {
              return;
            }
            if (row.operation === 'INSERT' || row.operation === 'DELETE') {
              debounceSync();
            }
            if (row.table === 'workflows') {
              if (row.id && currentIdsRef.current.has(row.id)) {
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
          setConnectionStatus('OFF');
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
          setConnectionStatus('OFF');
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
