import { createFileRoute } from '@tanstack/react-router';

import TemplateDetail from '@/components/template/TemplateDetail';

export const Route = createFileRoute('/_authenticated/templates/$templateSlug')(
  {
    component: TemplateDetailPage,
  },
);

function TemplateDetailPage() {
  const { templateSlug } = Route.useParams();
  return <TemplateDetail slug={templateSlug} />;
}
