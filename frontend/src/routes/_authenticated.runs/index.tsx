import { useEffect } from 'react';

import { useQuery } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Flex, Result, Spin } from 'antd';

import { getWorkflowIdByNameOptions } from '@/client/@tanstack/react-query.gen';
import WorkflowTable from '@/components/workflow/WorkflowTable';

type RunsSearchParams = {
  name?: string;
};

export const Route = createFileRoute('/_authenticated/runs/')({
  component: RunsIndex,
  validateSearch(search: Record<string, unknown>): RunsSearchParams {
    const raw = search.name;
    if (typeof raw === 'string' && raw) {
      return { name: decodeURIComponent(raw) };
    }
    return {};
  },
});

function RunsIndex() {
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const { data: workflowId, isLoading } = useQuery({
    ...getWorkflowIdByNameOptions({
      query: { name: name ?? '' },
    }),
    enabled: !!name,
  });

  useEffect(() => {
    if (name && workflowId) {
      navigate({
        to: '/runs/$workflowId',
        params: { workflowId },
        replace: true,
      });
    }
  }, [name, workflowId, navigate]);

  if (name && isLoading) {
    return (
      <Flex
        vertical
        align="center"
        justify="center"
        style={{ height: '80vh', width: '100%' }}
      >
        <Spin size="large" />
      </Flex>
    );
  }

  if (name && !isLoading && !workflowId) {
    return (
      <Flex
        vertical
        align="center"
        justify="center"
        style={{ height: '80vh', width: '100%' }}
      >
        <Result
          status="warning"
          title="Run Not Found"
          subTitle={`Could not find a run named "${name}"`}
        />
      </Flex>
    );
  }

  return (
    <div style={{ width: '100%', margin: '0 auto' }}>
      <WorkflowTable />
    </div>
  );
}
