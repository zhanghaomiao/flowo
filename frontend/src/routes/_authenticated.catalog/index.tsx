import { createFileRoute } from '@tanstack/react-router';

import CatalogList from '@/components/catalog/CatalogList';

export const Route = createFileRoute('/_authenticated/catalog/')({
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <div className="w-full h-full">
      <CatalogList />
    </div>
  );
}
