import { createFileRoute } from '@tanstack/react-router';

import { DashboardLayout } from '../components/dashboard';

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
});

function Dashboard() {
  return <DashboardLayout />;
}
