import { createFileRoute, Navigate } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/')({
  component: AuthenticatedIndexRedirect,
});

function AuthenticatedIndexRedirect() {
  return <Navigate to="/runs" replace />;
}
