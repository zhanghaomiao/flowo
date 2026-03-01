import { createFileRoute } from '@tanstack/react-router';

import CatalogDetail from '@/components/catalog/CatalogDetail';

export const Route = createFileRoute('/_authenticated/catalog/$catalogSlug')({
  component: CatalogDetailPage,
});

function CatalogDetailPage() {
  const { catalogSlug } = Route.useParams();
  return <CatalogDetail slug={catalogSlug} />;
}
