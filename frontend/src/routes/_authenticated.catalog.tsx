import { createFileRoute, Outlet } from '@tanstack/react-router';

/**
 * Catalog routes fill the main area without outer page scroll;
 * list/detail children control their own overflow.
 */
export const Route = createFileRoute('/_authenticated/catalog')({
  component: CatalogOutlet,
});

function CatalogOutlet() {
  return (
    <div className="flex flex-1 min-h-0 w-full flex-col overflow-hidden">
      <Outlet />
    </div>
  );
}
