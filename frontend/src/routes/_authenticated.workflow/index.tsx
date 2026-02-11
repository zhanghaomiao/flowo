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
      navigate({ to: `/workflow/${workflowId}` });
    }
  }, [name, workflowId, navigate]);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="text-lg">
      Redirecting to workflow id {String(workflowId)}...
    </div>
  );
}
