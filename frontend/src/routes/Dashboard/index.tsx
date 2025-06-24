import { createFileRoute } from "@tanstack/react-router";
import { useWorkflowSnakefile } from "../../hooks/useQueries";
import FileContent from "../../components/code/FileContent";
import SnakefileViewerWithFilter from "../../components/code/SnakefileViewerWithFilter";
import VirtualizedCodeViewer from "../../components/code/VirtualizedCodeViewer";

export const Route = createFileRoute("/Dashboard/")({
  component: RouteComponent,
});

function RouteComponent() {
  const { data: snakefileData } = useWorkflowSnakefile(
    "f19e43b1-d0cf-4388-83c4-674cdf8705cf"
  );
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 10,
        overflow: "auto",
        height: "400px",
        flex: 1,
      }}
    >
      <VirtualizedCodeViewer
        code={snakefileData}
        language="python"
        showLineNumbers={true}
      />
    </div>
  );
}
