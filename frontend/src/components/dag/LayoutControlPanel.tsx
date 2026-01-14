import { ClearOutlined, DownOutlined, RightOutlined } from '@ant-design/icons';
import { Button, Card, Radio, Space, Tooltip } from 'antd';
import React from 'react';

import { type LayoutDirection } from '../../utils/graphLayout';

interface LayoutControlPanelProps {
  layoutDirection: LayoutDirection;
  selectedRule?: string | null;
  onLayoutChange: (direction: LayoutDirection) => void;
  onClearRule?: () => void;
}

const LayoutControlPanel: React.FC<LayoutControlPanelProps> = ({
  layoutDirection,
  selectedRule,
  onLayoutChange,
  onClearRule,
}) => {
  return (
    <Card
      size="small"
      style={{
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
        border: '1px solid #d9d9d9',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: '500' }}>Layout:</span>
          <Radio.Group
            value={layoutDirection}
            onChange={(e) => onLayoutChange(e.target.value)}
            size="small"
          >
            <Tooltip title="Top to Bottom">
              <Radio.Button value="TB">
                <Space>
                  <DownOutlined />
                  TB
                </Space>
              </Radio.Button>
            </Tooltip>
            <Tooltip title="Left to Right">
              <Radio.Button value="LR">
                <Space>
                  <RightOutlined />
                  LR
                </Space>
              </Radio.Button>
            </Tooltip>
          </Radio.Group>
        </div>

        {selectedRule && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: '500' }}>
                Filter:
              </span>
              <span
                style={{
                  fontSize: '11px',
                  color: '#1890ff',
                  fontWeight: '500',
                  backgroundColor: '#f0f8ff',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  border: '1px solid #d4e8fc',
                }}
              >
                {selectedRule}
              </span>
              <Button
                size="small"
                icon={<ClearOutlined />}
                onClick={onClearRule}
                type="text"
                style={{ alignSelf: 'flex-start' }}
              />
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};

export default LayoutControlPanel;
