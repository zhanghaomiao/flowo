import WorkflowTable from '@/components/workflow/WorkflowTable';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: Index,
});

function Index() {
  return (
    <div style={{ width: '96%', margin: '0 auto' }}>
      <WorkflowTable />
    </div>
  );
}
