import { createFileRoute } from "@tanstack/react-router";

import WorkflowTable from "../components/workflow/WorkflowTable";
import { SSEManagerProvider } from "../hooks/useSSEManager.tsx";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <SSEManagerProvider>
      <div style={{ width: "96%", margin: "0 auto" }}>
        <WorkflowTable />
      </div>
    </SSEManagerProvider>
  );
}
