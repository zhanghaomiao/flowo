import { createFileRoute } from '@tanstack/react-router';

import { DashboardLayout } from '../components/dashboard';

export const Route = createFileRoute('/_authenticated/dashboard')({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      target_user_id: (search.target_user_id as string) || undefined,
    };
  },
  component: Dashboard,
});

function Dashboard() {
  return <DashboardLayout />;
}
