import React, { useMemo, useState } from 'react';

import {
  ApartmentOutlined,
  ArrowLeftOutlined,
  BranchesOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import {
  Button,
  Empty,
  message,
  Segmented,
  Spin,
  Tooltip,
  Typography,
} from 'antd';

import type {
  CatalogDetail,
  CatalogFileInfo,
  SnakeTemplateOverview,
} from '@/client/types.gen';
import {
  fetchSnakeTemplateFile,
  fetchSnakeTemplateOverview,
  pullSnakeTemplate,
  snakeTemplateQueryKey,
} from '@/lib/snakeTemplate';

import './CatalogDetail.css';

import { MarkdownViewer } from '../shared/viewers';

import CatalogEditor from './CatalogEditor';
import CatalogDagSvg from './detail/CatalogDagSvg';
import CatalogFileTree from './detail/CatalogFileTree';

const { Text, Paragraph } = Typography;

/** Stable fake id for template UI (never sent to user-catalog APIs). */
const TEMPLATE_CATALOG_ID = '00000000-0000-4000-8000-000000000001';
/** Display-only ref for the read-only file tree keys (no user-catalog API calls). */
const TREE_REF = '__snake_template__';

function overviewToCatalog(
  overview: SnakeTemplateOverview,
  dataUpdatedAt: number,
): CatalogDetail {
  const files: CatalogFileInfo[] = (overview.files || []).map((f) => {
    const row = f as {
      path?: string;
      name?: string;
      is_dir?: boolean;
      lines?: number;
      size?: number;
    };
    return {
      path: row.path ?? '',
      name: row.name ?? '',
      is_dir: row.is_dir ?? false,
      lines: row.lines ?? 0,
      size: row.size ?? 0,
      modified: '',
    };
  });
  const upstream = overview.upstream?.trim() || '';
  return {
    id: TEMPLATE_CATALOG_ID,
    name: 'Snakemake workflow template',
    slug: TREE_REF,
    description: upstream || 'Official Snakemake workflow template checkout',
    source_url: upstream.startsWith('http') ? upstream : null,
    files,
    updated_at: new Date(dataUpdatedAt).toISOString(),
    has_snakefile: files.some(
      (f) =>
        !f.is_dir && (f.name === 'Snakefile' || f.path.endsWith('/Snakefile')),
    ),
  };
}

const SnakemakeTemplatePage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [editingFiles, setEditingFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');
  const [rightPanelMode, setRightPanelMode] = useState<
    'readme' | 'preview' | 'editor'
  >('readme');
  const [editingViewMode, setEditingViewMode] = useState<'preview' | 'source'>(
    'source',
  );

  const overviewQuery = useQuery<
    SnakeTemplateOverview,
    Error,
    SnakeTemplateOverview
  >({
    queryKey: [...snakeTemplateQueryKey, 'overview'],
    queryFn: fetchSnakeTemplateOverview,
  });

  const syntheticCatalog = useMemo(() => {
    const o = overviewQuery.data;
    if (!o) return null;
    return overviewToCatalog(o, overviewQuery.dataUpdatedAt);
  }, [overviewQuery.data, overviewQuery.dataUpdatedAt]);

  const readmePath = useMemo(() => {
    const files = syntheticCatalog?.files;
    if (!files?.length) return null;
    const hit = files.find(
      (f) => !f.is_dir && f.name.toLowerCase() === 'readme.md',
    );
    return hit?.path ?? null;
  }, [syntheticCatalog]);

  const readmeQuery = useQuery({
    queryKey: [...snakeTemplateQueryKey, 'file', readmePath],
    queryFn: () => fetchSnakeTemplateFile(readmePath!),
    enabled:
      !!readmePath &&
      rightPanelMode === 'readme' &&
      !!overviewQuery.data?.ready,
  });

  const pullMut = useMutation({
    mutationFn: pullSnakeTemplate,
    onSuccess: async () => {
      message.success('Template updated from upstream');
      await queryClient.invalidateQueries({
        queryKey: [...snakeTemplateQueryKey],
      });
    },
    onError: (e: Error) => message.error(e.message),
  });

  const openFile = (filePath: string) => {
    setEditingViewMode('source');
    setEditingFiles((prev) =>
      prev.includes(filePath) ? prev : [...prev, filePath],
    );
    setActiveFile(filePath);
    setRightPanelMode('editor');
  };

  const o = overviewQuery.data;
  const templatePath = o?.path ?? '';

  const activeLower = activeFile.toLowerCase();
  const showMarkdownSourceToggle =
    rightPanelMode === 'editor' &&
    editingFiles.length > 0 &&
    (activeLower.endsWith('.md') || activeLower.endsWith('.markdown'));
  const showRightPanelTopBar =
    rightPanelMode !== 'editor' || showMarkdownSourceToggle;

  return (
    <div className="catalog-detail-page">
      <div className="catalog-detail-page-header">
        <div className="catalog-detail-toolbar">
          <div className="catalog-toolbar-left">
            <span
              className="catalog-back-link"
              onClick={() => navigate({ to: '/catalog' })}
            >
              <ArrowLeftOutlined />
              Catalogs
            </span>
            <span className="catalog-toolbar-sep">/</span>
            <span className="catalog-toolbar-name">
              Snakemake workflow template
            </span>
          </div>
          <div className="catalog-toolbar-right">
            <Button
              type="text"
              size="small"
              icon={<InfoCircleOutlined />}
              disabled={!readmePath || !o?.ready}
              onClick={() => setRightPanelMode('readme')}
            >
              README
            </Button>
            <Button
              type="text"
              size="small"
              icon={<ApartmentOutlined />}
              disabled={!syntheticCatalog?.has_snakefile || !o?.ready}
              onClick={() => setRightPanelMode('preview')}
            >
              DAG
            </Button>
            <Button
              icon={<ReloadOutlined />}
              loading={pullMut.isPending}
              onClick={() => pullMut.mutate()}
            >
              Pull / update
            </Button>
          </div>
        </div>
        {o?.upstream ? (
          <div className="mb-2 px-0.5">
            <Tooltip title={o.upstream} placement="bottomLeft">
              <Text type="secondary" className="cursor-default text-xs">
                <BranchesOutlined className="mr-1" />
                {o.upstream.length > 72
                  ? `${o.upstream.slice(0, 72)}…`
                  : o.upstream}
              </Text>
            </Tooltip>
          </div>
        ) : null}
      </div>

      <div className="catalog-detail-content">
        <div className="catalog-file-panel">
          {overviewQuery.isLoading ? (
            <div className="flex flex-1 items-center justify-center p-8">
              <Spin />
            </div>
          ) : !syntheticCatalog ? null : !o?.ready ? (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200/90 bg-white p-4">
              <Paragraph type="secondary" className="text-sm">
                Template not on disk yet. Click <strong>Pull / update</strong>{' '}
                to clone the official repository into:
              </Paragraph>
              <Text code className="break-all text-xs">
                {templatePath}
              </Text>
            </div>
          ) : (
            <CatalogFileTree
              catalog={syntheticCatalog}
              catalogRef={TREE_REF}
              onOpenFile={openFile}
            />
          )}
        </div>

        <div className="catalog-editor-panel flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
            {showRightPanelTopBar && (
              <div
                className={
                  showMarkdownSourceToggle && rightPanelMode === 'editor'
                    ? 'catalog-panel-segmented-host flex shrink-0 items-center justify-end border-b border-slate-100 px-3 py-1.5'
                    : 'flex shrink-0 items-center justify-between gap-2 border-b border-slate-100 px-3 py-1.5'
                }
              >
                {rightPanelMode !== 'editor' && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                    {rightPanelMode === 'preview' ? (
                      <>
                        <ApartmentOutlined /> DAG Preview
                      </>
                    ) : (
                      <>
                        <InfoCircleOutlined /> Overview
                      </>
                    )}
                  </span>
                )}
                {showMarkdownSourceToggle && (
                  <Segmented
                    size="small"
                    options={[
                      { label: 'Source', value: 'source' },
                      { label: 'Preview', value: 'preview' },
                    ]}
                    value={editingViewMode}
                    onChange={(value) =>
                      setEditingViewMode(value as 'preview' | 'source')
                    }
                  />
                )}
              </div>
            )}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {rightPanelMode === 'editor' ? (
                <CatalogEditor
                  catalogRef={TREE_REF}
                  fileSource="snake-template"
                  openFiles={editingFiles}
                  activeFile={activeFile}
                  onActiveFileChange={setActiveFile}
                  viewMode={editingViewMode}
                  onViewModeChange={setEditingViewMode}
                  onCloseAll={() => {
                    setEditingFiles([]);
                    setActiveFile('');
                    setRightPanelMode('readme');
                  }}
                  onClose={(filePath) => {
                    setEditingFiles((prev) => {
                      const next = prev.filter((f) => f !== filePath);
                      if (next.length === 0) {
                        setActiveFile('');
                        setRightPanelMode('readme');
                      } else {
                        setActiveFile((cur) =>
                          cur === filePath || !next.includes(cur)
                            ? next[next.length - 1]!
                            : cur,
                        );
                      }
                      return next;
                    });
                  }}
                />
              ) : rightPanelMode === 'preview' ? (
                syntheticCatalog?.has_snakefile ? (
                  <CatalogDagSvg variant="snake-template" />
                ) : (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#999',
                    }}
                  >
                    No Snakefile found — cannot preview the DAG
                  </div>
                )
              ) : readmePath ? (
                readmeQuery.isLoading ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin tip="Loading README..." />
                  </div>
                ) : (
                  <MarkdownViewer
                    content={readmeQuery.data?.content || ''}
                    fileName="README.md"
                  />
                )
              ) : (
                <Empty
                  description="No README.md in this template"
                  style={{ padding: 60 }}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SnakemakeTemplatePage;
