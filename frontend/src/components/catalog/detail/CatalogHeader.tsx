import React from 'react';

import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  BranchesOutlined,
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  GithubOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useNavigate } from '@tanstack/react-router';
import { Button, Dropdown, message, Space, Tag, Tooltip } from 'antd';

import type { CatalogDetail } from '@/client/types.gen';
import { downloadFile } from '@/utils/download';

interface Props {
  catalog: CatalogDetail;
  slug: string;
  onShowDag?: () => void;
  onEditMetadata?: () => void;
}

const CatalogHeader: React.FC<Props> = ({
  catalog,
  slug,
  onShowDag,
  onEditMetadata,
}) => {
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();

  const sourceUrl = catalog.source_url?.trim();
  const isGitSource = !!sourceUrl;
  const isGitHub = sourceUrl?.includes('github.com');

  return (
    <div className="catalog-detail-toolbar">
      {contextHolder}
      <div className="catalog-toolbar-left">
        <span
          className="catalog-back-link"
          onClick={() => navigate({ to: '/catalog' })}
        >
          <ArrowLeftOutlined />
          Catalogs
        </span>
        <span className="catalog-toolbar-sep">/</span>
        <Space size={4}>
          {isGitSource ? (
            <Tooltip title={isGitHub ? 'GitHub' : 'Git source'}>
              <a
                href={sourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 18,
                  marginRight: 4,
                }}
              >
                {isGitHub ? <GithubOutlined /> : <BranchesOutlined />}
              </a>
            </Tooltip>
          ) : (
            <Tooltip title="Local catalog">
              <span
                style={{
                  color: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  fontSize: 18,
                  marginRight: 4,
                }}
              >
                <UserOutlined />
              </span>
            </Tooltip>
          )}
          <Tooltip
            title={catalog.description || undefined}
            placement="bottomLeft"
          >
            <span className="catalog-toolbar-name">{catalog.name}</span>
          </Tooltip>
          <Button
            size="small"
            type="text"
            icon={<EditOutlined />}
            onClick={onEditMetadata}
            title="Edit Metadata"
          />
        </Space>
        <Tag
          color="blue"
          style={{
            fontSize: 11,
            padding: '0 6px',
            borderRadius: 10,
            fontWeight: 600,
            lineHeight: '20px',
            margin: 0,
            marginLeft: 8,
          }}
        >
          v{catalog.version}
        </Tag>
        {catalog.tags?.map((tag: string) => (
          <Tag
            key={tag}
            color="geekblue"
            style={{
              fontSize: 11,
              margin: 0,
              marginLeft: 4,
              lineHeight: '20px',
            }}
          >
            {tag}
          </Tag>
        ))}
      </div>
      <div className="catalog-toolbar-right">
        {catalog.has_snakefile && (
          <Button
            size="small"
            icon={<ApartmentOutlined />}
            onClick={onShowDag}
            style={{
              borderColor: '#4f46e5',
              color: '#4f46e5',
              background: '#f5f5ff',
            }}
          >
            DAG
          </Button>
        )}
        <Dropdown
          menu={{
            items: [
              {
                key: 'cli-header',
                type: 'group',
                label: 'CLI Command',
                children: [
                  {
                    key: 'copy-command',
                    label: (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 8,
                          padding: '4px 0',
                        }}
                      >
                        <code
                          style={{
                            background: '#f5f5f5',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 12,
                            color: '#d4380d',
                            fontFamily: 'monospace',
                          }}
                        >
                          flowo catalog download {catalog.slug}
                        </code>
                        <Tooltip title="Copy command">
                          <CopyOutlined
                            style={{ color: '#1890ff', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(
                                `flowo catalog download ${catalog.slug}`,
                              );
                              messageApi.success('Command copied to clipboard');
                            }}
                          />
                        </Tooltip>
                      </div>
                    ),
                  },
                ],
              },
              { type: 'divider' },
              {
                key: 'download-targz',
                icon: <DownloadOutlined />,
                label: 'Download as .tar.gz',
                onClick: async () => {
                  try {
                    await downloadFile(
                      `/api/v1/catalog/${slug}/download?format=tar.gz`,
                      `${slug}.tar.gz`,
                    );
                  } catch {
                    messageApi.error('Download failed');
                  }
                },
              },
              {
                key: 'download-zip',
                icon: <DownloadOutlined />,
                label: 'Download as .zip',
                onClick: async () => {
                  try {
                    await downloadFile(
                      `/api/v1/catalog/${slug}/download?format=zip`,
                      `${slug}.zip`,
                    );
                  } catch {
                    messageApi.error('Download failed');
                  }
                },
              },
            ],
          }}
          trigger={['click']}
          placement="bottomRight"
        >
          <Button size="small" type="primary" icon={<DownloadOutlined />}>
            Download
          </Button>
        </Dropdown>
      </div>
    </div>
  );
};

export default CatalogHeader;
