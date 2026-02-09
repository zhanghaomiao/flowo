import { client } from '@/client/client.gen';
import { useQueryClient } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { useEffect, useMemo, useRef, useState } from 'react';

const TAG_WORKFLOWS = 'workflow';
const TAG_JOBS = 'job';

// 辅助函数：基于 Tag 的 Invalidate
const invalidateByTag = (queryClient: any, tag: string) => {
  return queryClient.invalidateQueries({
    predicate: (query: any) => {
      const keyObj = query.queryKey[0] as any;
      return Array.isArray(keyObj?.tags) && keyObj.tags.includes(tag);
    },
  });
};

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
    let eventSource: EventSource | null = null;
    let isActive = true;
    let retryTimeout: NodeJS.Timeout | null = null;

    const connectSSE = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setConnectionStatus('OFF');
        return;
      }

      setConnectionStatus('CONNECTING');

      try {
        // 1. Get short-lived ticket
        const ticketRes = await fetch('/api/v1/sse/ticket', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!ticketRes.ok) {
          throw new Error('Failed to obtain SSE ticket');
        }

        const { ticket } = await ticketRes.json();

        if (!isActive) return;

        // 2. Connect with ticket
        const url = client.buildUrl({
          url: '/api/v1/sse/events',
          query: { token: ticket },
        });

        eventSource = new EventSource(url);

        eventSource.onopen = () => {
          if (isActive) {
            setConnectionStatus('ONLINE');
            invalidateByTag(queryClient, TAG_WORKFLOWS);
          }
        };

        eventSource.onerror = () => {
          if (isActive) {
            setConnectionStatus('CONNECTING');
            eventSource?.close();
            // Retry connection after 3 seconds
            retryTimeout = setTimeout(() => {
              connectSSE();
            }, 3000);
          }
        };

        eventSource.addEventListener('message', (event) => {
          if (!isActive) return;
          try {
            const data = JSON.parse(event.data);
            const { table, operation, id, workflow_id } = data;

            if (data.operation === 'UPDATE' && !data.new_status) return;
            if (data.operation === 'INSERT' || data.operation === 'DELETE') {
              debounceSync();
            }
            if (table === 'workflows') {
              if (currentIdsRef.current.has(id)) {
                debounceSync();
              }
            } else if (table === 'jobs') {
              if (currentIdsRef.current.has(workflow_id)) {
                debounceSync();
              }
            }
          } catch (e) {
            console.error('SSE Parse Error', e);
          }
        });
      } catch (error) {
        console.error('SSE Connection Error:', error);
        if (isActive) {
          setConnectionStatus('OFF');
          // Retry connection after 5 seconds on fatal error
          retryTimeout = setTimeout(() => {
            connectSSE();
          }, 5000);
        }
      }
    };

    connectSSE();

    return () => {
      isActive = false;
      eventSource?.close();
      if (retryTimeout) clearTimeout(retryTimeout);
      debounceSync.cancel();
    };
  }, [queryClient, debounceSync]);
  return connectionStatus;
};
