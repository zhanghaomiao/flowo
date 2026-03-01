import { createFileRoute } from '@tanstack/react-router';

import CatalogList from '@/components/catalog/CatalogList';

export const Route = createFileRoute('/_authenticated/catalog/')({
  component: CatalogPage,
});

function CatalogPage() {
  return (
    <div style={{ width: '96%', margin: '0 auto' }}>
      <CatalogList />
    </div>
  );
}
