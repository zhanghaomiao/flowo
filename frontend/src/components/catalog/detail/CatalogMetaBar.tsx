import React from 'react';

import type { CatalogDetail } from '@/client/types.gen';

import CatalogFooter from './CatalogFooter';

interface Props {
  catalog: CatalogDetail;
}

/** Page-level metadata (owner, timestamps, visibility) — not part of the file sidebar. */
const CatalogMetaBar: React.FC<Props> = ({ catalog }) => {
  return (
    <div className="mb-2 [&_.catalog-detail-footer]:mt-0 [&_.catalog-detail-footer]:border-t [&_.catalog-detail-footer]:border-slate-100 [&_.catalog-detail-footer]:py-1.5 [&_.catalog-detail-footer]:pb-2">
      <CatalogFooter catalog={catalog} />
    </div>
  );
};

export default CatalogMetaBar;
