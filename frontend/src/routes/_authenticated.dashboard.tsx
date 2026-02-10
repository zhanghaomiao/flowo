import { createFileRoute } from '@tanstack/react-router';

import { DashboardLayout } from '../components/dashboard';

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
});

function Dashboard() {
  return <DashboardLayout />;
}
