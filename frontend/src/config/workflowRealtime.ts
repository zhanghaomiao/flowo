import { client } from '@/client/client.gen';
import { useQueryClient } from '@tanstack/react-query';
import debounce from 'lodash/debounce';
import { useEffect, useMemo } from 'react';

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

export const useWorkflowRealtime = (workflows: { id: string }[] = [], enableGlobalInsert: boolean = false, shouldPause: boolean = false) => {
  const queryClient = useQueryClient();

  // 生成 ID 字符串 (用于 SSE 订阅)
  const workflowIdsString = useMemo(
    () =>
      workflows
        .map((w) => w.id)
        .sort()
        .join(','),
    [workflows],
  );

  // ==========================================
  // 2. [慢速防抖] 处理 Workflow 列表新增
  // 场景：批量导入 Workflow，防止列表疯狂刷新
  // 延迟：1000ms
  // ==========================================
  const debouncedRefreshList = useMemo(
    () =>
      debounce(() => {
        console.log('🔄 [SSE] Slow Debounce: Refreshing Workflow List');
        invalidateByTag(queryClient, TAG_WORKFLOWS);
      }, 1000),
    [queryClient],
  );

  // ==========================================
  // 3. [快速防抖] 处理状态变更 & Job 变更
  // 场景：Job 批量插入、进度条高频更新
  // 延迟：500ms (保证体验的同时，合并高频请求)
  // ==========================================
  const debouncedSyncActiveData = useMemo(
    () =>
      debounce(() => {
        console.log(
          '⚡️ [SSE] Fast Debounce: Syncing Active Data (Jobs & Details)',
        );
        invalidateByTag(queryClient, TAG_JOBS);
        invalidateByTag(queryClient, TAG_WORKFLOWS);
      }, 500),
    [queryClient],
  );

  useEffect(() => {
    // 构建 URL
    if (shouldPause) {
      return;
    }
    const url = client.buildUrl({
      url: '/api/v1/sse/events',
      query:
      {
        workflow_ids: workflowIdsString || undefined,
        global_insert: enableGlobalInsert
      }
    });

    const eventSource = new EventSource(url);

    eventSource.addEventListener('message', (event) => {
      console.log('🔌 [SSE] Message:', event.data);
      try {
        const data = JSON.parse(event.data);

        if (data.operation === 'UPDATE' && !data.new_status) return;

        if (data.table === 'workflows') {
          if (data.operation === 'INSERT') {
            debouncedRefreshList();
          } else {
            debouncedSyncActiveData();
          }
        }
        else if (data.table === 'jobs') {
          debouncedSyncActiveData();
        }
      } catch (e) {
        console.error('SSE Parse Error', e);
      }
    });

    return () => {
      eventSource.close();
      debouncedRefreshList.cancel();
      debouncedSyncActiveData.cancel();
    };
  }, [
    workflowIdsString,
    queryClient,
    debouncedRefreshList,
    debouncedSyncActiveData,
    enableGlobalInsert,
    shouldPause,
  ]);
};
