import React from 'react';

import { CalendarOutlined, UserOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

import type { CatalogDetail } from '@/client/types.gen';

interface Props {
  catalog: CatalogDetail;
}

const CatalogFooter: React.FC<Props> = ({ catalog }) => {
  return (
    <div className="catalog-detail-footer">
      <span className="catalog-footer-item">
        <UserOutlined />
        <span className="catalog-footer-value">{catalog.owner}</span>
      </span>
      <span className="catalog-footer-item">
        <CalendarOutlined />
        Created{' '}
        <span className="catalog-footer-value">
          {dayjs(catalog.created_at).format('YYYY-MM-DD HH:mm')}
        </span>
      </span>
    </div>
  );
};

export default CatalogFooter;
