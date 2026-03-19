import { useEffect } from 'react';

import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { useGetWorkflowIdByNameQuery } from '@/client/@tanstack/react-query.gen';

type WorkflowSearchParams = {
  name: string;
};

export const Route = createFileRoute('/_authenticated/workflow/')({
  component: RouteComponent,
  validateSearch(search: Record<string, string>): WorkflowSearchParams {
    return {
      name: search.name ? decodeURIComponent(search.name) : '',
    };
  },
});

import { Flex, Result, Spin } from 'antd';
function RouteComponent() {
  const { name } = Route.useSearch();
  const navigate = useNavigate();
  const { data: workflowId, isLoading } = useGetWorkflowIdByNameQuery({
    query: {
      name,
    },
  });

  useEffect(() => {
    if (name && workflowId) {
      navigate({
        to: '/workflow/$workflowId',
        params: { workflowId },
      });
    }
  }, [name, workflowId, navigate]);

  if (isLoading) {
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

  if (name && !workflowId) {
    return (
      <Flex
        vertical
        align="center"
        justify="center"
        style={{ height: '80vh', width: '100%' }}
      >
        <Result
          status="warning"
          title="Workflow Not Found"
          subTitle={`Could not find a workflow named "${name}"`}
        />
      </Flex>
    );
  }

  return (
    <Flex
      vertical
      align="center"
      justify="center"
      style={{ height: '80vh', width: '100%' }}
      gap="middle"
    >
      <Spin size="large" />
    </Flex>
  );
}
