import { createFileRoute } from '@tanstack/react-router';

import { SettingsPage } from '@/components/settings/SettingsPage';

import { useAuth } from '../auth';

export const Route = createFileRoute('/_authenticated/settings')({
  component: RouteComponent,
});

function RouteComponent() {
  const { token } = useAuth();
  return <SettingsPage token={token} />;
}
