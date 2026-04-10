import { useEffect, useState } from 'react';

import {
  ClockCircleOutlined,
  CodeOutlined,
  FileOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Splitter, Tabs } from 'antd';

import {
  getRulesOptions,
  getSnakefileOptions,
  useGetDetailQuery,
} from '@/client/@tanstack/react-query.gen';
import type { RuleResponse, Status } from '@/client/types.gen';
import { ResultViewer } from '@/components/features/result/ResultViewer.tsx';
import WorkflowGraph from '@/components/job/dag/Dag';
import JobTable from '@/components/job/JobTable.tsx';
import { CodeViewer } from '@/components/shared/viewers';
import WorkflowProgress from '@/components/workflow/WorkflowProgress.tsx';
import WorkflowTimeline from '@/components/workflow/WorkflowTimeline.tsx';
import { useWorkflowRealtime } from '@/config/workflowRealtime';
import { useWorkflowState } from '@/hooks/useWorkflowState.ts';

export const Route = createFileRoute('/_authenticated/workflow/$workflowId')({
  component: WorkflowDetail,
});

function WorkflowDetail() {
  const { workflowId } = Route.useParams();

  // Use simplified state management
  const {
    selectedRule,
    highlightedRule,
    activeTab,
    setSelectedRule,
    setActiveTab,
    clearRuleFilter,
    handleJobSelect,
  } = useWorkflowState();

  useWorkflowRealtime([workflowId]);

  const { data: workflow } = useGetDetailQuery({
    path: {
      workflow_id: workflowId!,
    },
  });

  const [enableSnakefile, setEnableSnakefile] = useState(false);
  useEffect(() => {
    setEnableSnakefile(activeTab === 'code');
  }, [activeTab]);

  const workflowStatus = workflow?.status;
  const handleNodeClick = (ruleName: string) => {
    if (selectedRule === ruleName) {
      setSelectedRule(null);
    } else {
      setSelectedRule(ruleName);
      setActiveTab('code');
    }
  };

  const { data: snakefileContent } = useQuery({
    ...getSnakefileOptions({
      path: {
        workflow_id: workflowId as string,
      },
    }),
    enabled: enableSnakefile && !selectedRule,
  });

  const { data: rulesData } = useQuery(
    Object.assign(
      getRulesOptions({
        path: {
          workflow_id: workflowId as string,
        },
      }),
      { enabled: enableSnakefile && !!selectedRule },
    ),
  );

  const selectedRuleData = selectedRule
    ? rulesData?.rules?.find((r: RuleResponse) => r.name === selectedRule)
    : null;

  return (
    <div className="w-full px-2 mx-auto font-sans">
      <div className="my-3">
        <WorkflowProgress workflowId={workflowId} />
      </div>

      <div className="h-[calc(100vh-200px)]">
        <Splitter>
          <Splitter.Panel defaultSize="33%" min="20%" max="60%">
            <div className="h-full pr-2">
              <WorkflowGraph
                workflowId={workflowId}
                onNodeClick={handleNodeClick}
                selectedRule={selectedRule}
                onClearRule={clearRuleFilter}
                highlightedRule={highlightedRule}
              />
            </div>
          </Splitter.Panel>

          <Splitter.Panel className="h-full">
            <div className="h-full flex flex-col relative">
              {/* Fixed Tabs Header */}
              <div className="sticky top-0 z-10 bg-white border-b border-slate-100 flex-shrink-0">
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  tabBarStyle={{
                    margin: 0,
                    paddingLeft: '10px',
                  }}
                  items={[
                    {
                      key: 'jobs',
                      label: (
                        <span className="flex items-center gap-1.5 font-bold">
                          <UnorderedListOutlined />
                          Jobs
                        </span>
                      ),
                    },
                    {
                      key: 'timeline',
                      label: (
                        <span className="flex items-center gap-1.5 font-bold">
                          <ClockCircleOutlined />
                          Timeline
                        </span>
                      ),
                    },
                    {
                      key: 'code',
                      label: (
                        <span className="flex items-center gap-1.5 font-bold">
                          <CodeOutlined />
                          Code
                        </span>
                      ),
                    },
                    {
                      key: 'result',
                      label: (
                        <span className="flex items-center gap-1.5 font-bold">
                          <FileOutlined />
                          Result
                        </span>
                      ),
                    },
                  ]}
                />
              </div>

              <div className="flex-1 min-h-0 overflow-hidden relative">
                {activeTab === 'jobs' && (
                  <div className="h-full pl-2 overflow-auto">
                    <JobTable
                      workflowId={workflowId}
                      workflowStatus={workflowStatus as Status}
                      ruleName={selectedRule}
                      showRefreshButton={true}
                    />
                  </div>
                )}

                {activeTab === 'timeline' && (
                  <div className="h-full w-full pl-2 overflow-hidden relative">
                    <WorkflowTimeline
                      workflowId={workflowId}
                      selectedRule={selectedRule}
                      onJobSelect={handleJobSelect}
                    />
                  </div>
                )}

                {activeTab === 'code' && (
                  <CodeViewer
                    content={
                      (selectedRule
                        ? (selectedRuleData?.code ??
                          'No code found for this rule')
                        : (snakefileContent?.content as string)) || ''
                    }
                    fileFormat={selectedRuleData?.language || 'python'}
                    title={selectedRule ? `Rule: ${selectedRule}` : 'Snakefile'}
                  />
                )}
                {activeTab === 'result' && (
                  <div className="h-full pl-2 overflow-hidden flex flex-col">
                    <ResultViewer
                      workflowId={workflowId}
                      selectedRule={selectedRule || undefined}
                    />
                  </div>
                )}
              </div>
            </div>
          </Splitter.Panel>
        </Splitter>
      </div>
    </div>
  );
}
