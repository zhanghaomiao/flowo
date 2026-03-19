import React from 'react';

import {
  CalendarOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { Tag } from 'antd';
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
      <span className="catalog-footer-item">
        <ClockCircleOutlined />
        Updated{' '}
        <span className="catalog-footer-value">
          {dayjs(catalog.updated_at).fromNow()}
        </span>
      </span>
      <span className="catalog-footer-item">
        <EyeOutlined />
        {catalog.is_public ? (
          <Tag color="green" style={{ margin: 0 }}>
            Public
          </Tag>
        ) : (
          <Tag style={{ margin: 0 }}>Private</Tag>
        )}
      </span>
    </div>
  );
};

export default CatalogFooter;
