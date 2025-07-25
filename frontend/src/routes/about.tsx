import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  component: About,
});

function About() {
  return (
    <div style={{ padding: "20px", maxWidth: "800px", margin: "0 auto" }}>
      <p>This is a frontend application for monitoring workflow executions.</p>
      <ul>
        <li>View workflow execution history</li>
        <li>Monitor job statuses and details</li>
        <li>Visualize workflow rule dependencies</li>
        <li>Interactive graph-based job filtering</li>
      </ul>
    </div>
  );
}
