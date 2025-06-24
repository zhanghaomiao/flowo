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
    "30d2c60f-2ab8-4484-9a6a-62277ab9fac0",
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
      {/* <FileContent fileContent={snakefileData} fileFormat="python" /> */}
      <VirtualizedCodeViewer
        code={snakefileData}
        language="python"
        showLineNumbers={true}
      />
    </div>
  );
}
