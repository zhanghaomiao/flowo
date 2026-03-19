import React from 'react';

import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  CloudUploadOutlined,
  CopyOutlined,
  DownloadOutlined,
  EditOutlined,
  GithubOutlined,
  SyncOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, Dropdown, message, Space, Tag, Tooltip } from 'antd';

import {
  getCatalogQueryKey,
  gitPushMutation,
  syncCatalogsMutation,
} from '@/client/@tanstack/react-query.gen';
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
  const queryClient = useQueryClient();

  const syncMutation = useMutation(syncCatalogsMutation());
  const gitMutation = useMutation(gitPushMutation());

  const handleReloadFromDisk = async () => {
    try {
      await syncMutation.mutateAsync({});
      queryClient.invalidateQueries({
        queryKey: getCatalogQueryKey({ path: { slug } }),
      });
      messageApi.success('Database synchronized with filesystem');
    } catch {
      // Handled by client
    }
  };

  const handlePushToRemote = async () => {
    try {
      const result = await gitMutation.mutateAsync({
        body: {},
      });

      const status = (result as { status?: string })?.status;
      if (status === 'nothing_to_push') {
        messageApi.info(
          'Nothing new to push — catalogs are already up to date.',
          3,
        );
      } else {
        messageApi.success('Catalogs pushed successfully!', 3);
      }
    } catch (err: unknown) {
      console.error('Git push failed:', err);
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Failed to push catalogs. Check your Git settings.';
      messageApi.error(errorMsg, 5);
    }
  };

  const isGitHub = catalog.source_url?.includes('github.com');

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
          <Tooltip title={isGitHub ? 'GitHub Source' : 'Local Source'}>
            <a
              href={catalog.source_url || undefined}
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
              {isGitHub ? <GithubOutlined /> : <UserOutlined />}
            </a>
          </Tooltip>
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
        <Tooltip
          title={
            !catalog.git_configured
              ? 'Git remote not configured. Please set it up in User Settings.'
              : 'Push catalogs to Git monorepo'
          }
        >
          <Button
            size="small"
            icon={<CloudUploadOutlined />}
            loading={gitMutation.isPending}
            onClick={handlePushToRemote}
            disabled={!catalog.git_configured}
          >
            Push to Git
          </Button>
        </Tooltip>
        <Tooltip title="Sync database from filesystem">
          <Button
            size="small"
            icon={<SyncOutlined spin={syncMutation.isPending} />}
            onClick={handleReloadFromDisk}
            loading={syncMutation.isPending}
          >
            Reload from Disk
          </Button>
        </Tooltip>
      </div>
    </div>
  );
};

export default CatalogHeader;
