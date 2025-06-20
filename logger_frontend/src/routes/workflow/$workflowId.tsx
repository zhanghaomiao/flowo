import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button, Splitter } from 'antd'
import { ArrowLeftOutlined } from '@ant-design/icons'
import JobTable from '../../components/job/JobTable'
import WorkflowGraph from '../../components/workflow/WorkflowGraph'
import WorkflowProgress from '../../components/workflow/WorkflowProgress'

export const Route = createFileRoute('/workflow/$workflowId')({
  component: WorkflowDetail,
})

function WorkflowDetail() {
  const { workflowId } = Route.useParams()
  const [selectedRule, setSelectedRule] = useState<string | null>(null)

  const handleNodeClick = (ruleName: string) => {
    setSelectedRule(selectedRule === ruleName ? null : ruleName)
  }

  const handleClearRuleFilter = () => {
    setSelectedRule(null)
  }

  return (
    <div style={{ width: '90%', margin: '0 auto' }}>
      <div style={{ marginBottom: '20px' }}>
        <Link to="/">
          <Button
            icon={<ArrowLeftOutlined />}
            type="text"
            style={{
              padding: '4px 8px',
              height: 'auto',
              fontSize: '14px'
            }}
          >
            Back to Workflows
          </Button>
        </Link>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <WorkflowProgress workflowId={workflowId} />
      </div>

      <div style={{ height: 'calc(100vh - 320px)' }}>
        <Splitter>
          <Splitter.Panel defaultSize="33%" min="20%" max="60%">
            <div style={{ height: '100%', padding: '0 10px 0 0' }}>
              <WorkflowGraph
                workflowId={workflowId}
                onNodeClick={handleNodeClick}
                selectedRule={selectedRule}
              />
            </div>
          </Splitter.Panel>

          <Splitter.Panel>
            <div style={{ height: '100%', padding: '0 0 0 10px' }}>
              <JobTable
                workflowId={workflowId}
                ruleName={selectedRule}
                showRefreshButton={true}
                onClearRuleFilter={handleClearRuleFilter}
              />
            </div>
          </Splitter.Panel>
        </Splitter>
      </div>
    </div>
  )
} 