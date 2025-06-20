import { createFileRoute } from '@tanstack/react-router'
import WorkflowTable from '../components/workflow/WorkflowTable'

export const Route = createFileRoute('/')({
  component: Index,
})

function Index() {
  return (
    <div style={{ width: '90%', margin: '0 auto' }}>
      <WorkflowTable limit={20} />
    </div>
  )
}