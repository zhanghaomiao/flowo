import { createFileRoute } from '@tanstack/react-router';

import SnakemakeTemplatePage from '@/components/catalog/SnakemakeTemplatePage';

export const Route = createFileRoute('/_authenticated/catalog/template')({
  component: SnakemakeTemplateRoute,
});

function SnakemakeTemplateRoute() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <SnakemakeTemplatePage />
    </div>
  );
}
