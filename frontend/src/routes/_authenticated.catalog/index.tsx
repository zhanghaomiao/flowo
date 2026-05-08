import { createFileRoute } from '@tanstack/react-router';

import CatalogList from '@/components/catalog/CatalogList';

export const Route = createFileRoute('/_authenticated/catalog/')({
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-auto">
      <CatalogList />
    </div>
  );
}
