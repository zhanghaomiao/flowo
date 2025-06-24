import {
  ClockCircleOutlined,
  CodeOutlined,
  FileOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { createFileRoute } from "@tanstack/react-router";
import { Splitter, Tabs } from "antd";
import { useEffect, useState } from "react";

import type { Status } from "../../api/api";
import FileContent from "../../components/code/FileContent";
import SnakefileViewerWithFilter from "../../components/code/SnakefileViewerWithFilter";
import JobTable from "../../components/job/JobTable";
import { ResultViewer } from "../../components/result/ResultViewer";
import WorkflowGraph from "../../components/workflow/WorkflowGraph";
import WorkflowProgress from "../../components/workflow/WorkflowProgress";
import WorkflowTimeline from "../../components/workflow/WorkflowTimeline";
import { useWorkflow } from "../../hooks/useQueries";
import { useWorkflowSnakefile } from "../../hooks/useQueries";

export const Route = createFileRoute("/workflow/$workflowId")({
  component: WorkflowDetail,
});

function WorkflowDetail() {
  const { workflowId } = Route.useParams();
  const [selectedRule, setSelectedRule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("jobs");
  const [highlightedRule, setHighlightedRule] = useState<string | null>(null);

  const { data: workflow } = useWorkflow(workflowId);
  const [enableSnakefile, setEnableSnakefile] = useState(false);

  // Enable snakefile when activeTab is "code"
  useEffect(() => {
    setEnableSnakefile(activeTab === "code");
  }, [activeTab]);

  const workflowStatus = workflow?.status as Status;

  const handleNodeClick = (ruleName: string) => {
    setSelectedRule(selectedRule === ruleName ? null : ruleName);
  };

  const handleClearRuleFilter = () => {
    setSelectedRule(null);
  };

  const handleJobSelect = (
    jobInfo: {
      jobId: string;
      ruleName: string;
      startTime: string;
      endTime: string;
      status: string;
    } | null,
  ) => {
    if (jobInfo) {
      // Highlight the rule in the graph when a job is selected in the timeline
      setHighlightedRule(jobInfo.ruleName);
    } else {
      // Clear highlighting when no job is selected
      setHighlightedRule(null);
    }
  };

  const { data: snakefileContent } = useWorkflowSnakefile(
    workflowId,
    enableSnakefile,
  );

  return (
    <div style={{ width: "90%", margin: "0 auto" }}>
      <div style={{ marginBottom: "10px" }}>
        <WorkflowProgress workflowId={workflowId} />
      </div>

      <div style={{ height: "calc(100vh - 220px)" }}>
        <Splitter>
          <Splitter.Panel defaultSize="33%" min="20%" max="60%">
            <div style={{ height: "100%", padding: "0 10px 0 0" }}>
              <WorkflowGraph
                workflowId={workflowId}
                onNodeClick={handleNodeClick}
                selectedRule={selectedRule}
                onClearRule={handleClearRuleFilter}
                highlightedRule={highlightedRule}
              />
            </div>
          </Splitter.Panel>

          <Splitter.Panel style={{ height: "100%" }}>
            <div
              style={{
                height: "100%",
                display: "flex",
                flexDirection: "column",
                position: "relative",
              }}
            >
              {/* Fixed Tabs Header */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1000,
                  backgroundColor: "#fff",
                  borderBottom: "1px solid #f0f0f0",
                  flexShrink: 0,
                }}
              >
                <Tabs
                  activeKey={activeTab}
                  onChange={setActiveTab}
                  tabBarStyle={{
                    margin: 0,
                    paddingLeft: "10px",
                  }}
                  items={[
                    {
                      key: "jobs",
                      label: (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <UnorderedListOutlined />
                          Jobs
                        </span>
                      ),
                    },
                    {
                      key: "timeline",
                      label: (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <ClockCircleOutlined />
                          Timeline
                        </span>
                      ),
                    },
                    {
                      key: "code",
                      label: (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <CodeOutlined />
                          Code
                        </span>
                      ),
                    },
                    {
                      key: "result",
                      label: (
                        <span
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <FileOutlined />
                          Result
                        </span>
                      ),
                    },
                  ]}
                />
              </div>

              <div
                style={{
                  flex: 1,
                  height: "100%",
                  overflow: "hidden",
                  position: "relative",
                }}
              >
                {activeTab === "jobs" && (
                  <div
                    style={{
                      height: "100%",
                      padding: "0 0 0 10px",
                      overflow: "auto",
                    }}
                  >
                    <JobTable
                      workflowId={workflowId}
                      workflowStatus={workflowStatus}
                      ruleName={selectedRule}
                      showRefreshButton={true}
                    />
                  </div>
                )}

                {activeTab === "timeline" && (
                  <div
                    style={{
                      height: "100%",
                      width: "100%",
                      padding: "0 0 0 10px",
                      overflow: "hidden",
                      position: "relative",
                    }}
                  >
                    <WorkflowTimeline
                      workflowId={workflowId}
                      selectedRule={selectedRule}
                      onJobSelect={handleJobSelect}
                    />
                  </div>
                )}

                {activeTab === "code" && (
                  <FileContent
                    fileContent={snakefileContent}
                    fileFormat="python"
                  />
                )}

                {activeTab === "result" && (
                  <div
                    style={{
                      height: "100%",
                      padding: "0 0 0 10px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <ResultViewer workflowId={workflowId} />
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
