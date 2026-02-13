import { createFileRoute } from '@tanstack/react-router';

import TemplateList from '@/components/template/TemplateList';

export const Route = createFileRoute('/_authenticated/templates/')({
  component: TemplatesPage,
});

function TemplatesPage() {
  return (
    <div style={{ width: '96%', margin: '0 auto' }}>
      <TemplateList />
    </div>
  );
}
