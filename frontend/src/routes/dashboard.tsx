import { createFileRoute } from "@tanstack/react-router";

import { DashboardLayout } from "../components/dashboard";
import { SSEManagerProvider } from "../hooks/useSSEManager.tsx";

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  return (
    <SSEManagerProvider>
      <DashboardLayout />
    </SSEManagerProvider>
  );
}
