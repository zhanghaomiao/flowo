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
  const [connectionStatus, setConnectionStatus] = useState<'OFF' | 'CONNECTING' | 'ONLINE'>('OFF');

  const currentIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    currentIdsRef.current = new Set(workflows);
  }, [workflows])
  

  const debounceSync = useMemo(
    () =>
      debounce(() => {
        invalidateByTag(queryClient, TAG_WORKFLOWS);
      }, 1000, 
      {
        leading: false,
        trailing: true,
        maxWait: 2000
      }
    ),
    [queryClient],
  );


  useEffect(() => {
    setConnectionStatus('CONNECTING');
    const url = client.buildUrl({
      url: '/api/v1/sse/events',
    });

    const eventSource = new EventSource(url);
    eventSource.onopen = () => {
      setConnectionStatus('ONLINE');
      invalidateByTag(queryClient, TAG_WORKFLOWS);
    };

    eventSource.onerror = () => {
      setConnectionStatus('CONNECTING');
      eventSource.close();
    };

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        const {table, operation, id, workflow_id} = data;

        if (data.operation === 'UPDATE' && !data.new_status) return;
        if (data.operation === 'INSERT' || data.operation === 'DELETE') { 
          debounceSync()
        }
        if (table === 'workflows') {
          if (currentIdsRef.current.has(id)) {
            debounceSync();
          }
        }
        else if (table === 'jobs') { 
          if (currentIdsRef.current.has(workflow_id)) {
            debounceSync();
          }
        }
      } catch (e) {
        console.error('SSE Parse Error', e);
      }
    });

    return () => {
      eventSource.close();
      debounceSync.cancel();
    };
  }, [
    queryClient,
    debounceSync
  ]);
  return connectionStatus
};
