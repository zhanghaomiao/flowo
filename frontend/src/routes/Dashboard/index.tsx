import { DashboardLayout } from '@/components/dashboard';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/Dashboard/')({
  component: Dashboard,
});

function Dashboard() {
  return <DashboardLayout />;
}
