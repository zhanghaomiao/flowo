import { createFileRoute, Outlet } from '@tanstack/react-router';

export const Route = createFileRoute('/_authenticated/runs')({
  component: RunsOutlet,
});

function RunsOutlet() {
  return (
    <div className="flex flex-1 min-h-0 w-full flex-col overflow-y-auto">
      <Outlet />
    </div>
  );
}
