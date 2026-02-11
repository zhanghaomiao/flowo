import { createFileRoute } from '@tanstack/react-router';

import WorkflowTable from '@/components/workflow/WorkflowTable';

export const Route = createFileRoute('/_authenticated/')({
  component: Index,
});

function Index() {
  return (
    <div style={{ width: '96%', margin: '0 auto' }}>
      <WorkflowTable />
    </div>
  );
}
