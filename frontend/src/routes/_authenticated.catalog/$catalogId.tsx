import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';

import CatalogDetail from '@/components/catalog/CatalogDetail';

const catalogSearchSchema = z.object({
  mode: z.enum(['preview', 'editor', 'readme']).optional(),
  edit: z.boolean().optional(),
});

export const Route = createFileRoute('/_authenticated/catalog/$catalogId')({
  validateSearch: catalogSearchSchema,
  component: CatalogDetailPage,
});

function CatalogDetailPage() {
  const { catalogId } = Route.useParams();
  return <CatalogDetail catalogRef={catalogId} />;
}
