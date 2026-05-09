import React, { useEffect, useState } from 'react';

import {
  ApartmentOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, Empty, Segmented, Spin } from 'antd';

import {
  getCatalogOptions,
  readFile2Options,
} from '@/client/@tanstack/react-query.gen';
import { Route } from '@/routes/_authenticated.catalog/$catalogSlug';

import './CatalogDetail.css';

import { MarkdownViewer } from '../shared/viewers';

import CatalogEditor from './CatalogEditor';
import CatalogDagSvg from './detail/CatalogDagSvg';
import CatalogFileTree from './detail/CatalogFileTree';
import CatalogHeader from './detail/CatalogHeader';
import CatalogMetaBar from './detail/CatalogMetaBar';
import EditCatalogModal from './EditCatalogModal';

interface Props {
  slug: string;
}

const CatalogDetail: React.FC<Props> = ({ slug }) => {
  const navigate = useNavigate();

  const {
    data: catalog,
    isLoading,
    error,
  } = useQuery({
    ...getCatalogOptions({ path: { slug } }),
    enabled: !!slug && slug !== '{slug}',
  });

  const [editingFiles, setEditingFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');

  // Get mode from search params (e.g. ?mode=editor)
  const search = Route.useSearch();
  const initialMode = search.mode || 'readme';

  // Right panel mode: 'readme', 'preview' (DAG), or 'editor'
  const [rightPanelMode, setRightPanelMode] = useState<
    'preview' | 'editor' | 'readme'
  >(initialMode);

  // Sync mode if search param changes
  useEffect(() => {
    if (search.mode) {
      setRightPanelMode(search.mode);
    }
    if (search.edit) {
      setEditModalOpen(true);
    }
  }, [search.mode, search.edit]);

  // README state
  const [readmePath, setReadmePath] = useState<string | null>(null);
  const [editingViewMode, setEditingViewMode] = useState<'preview' | 'source'>(
    'source',
  );
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    if (catalog?.files) {
      const readme = catalog.files.find(
        (f) => f.name.toLowerCase() === 'readme.md',
      );
      if (readme) {
        setReadmePath(readme.path);
      }
    }
  }, [catalog]);

  const { data: readmeContentData, isLoading: isReadmeLoading } = useQuery({
    ...readFile2Options({
      path: { slug, file_path: readmePath || '' },
    }),
    enabled: !!readmePath && rightPanelMode === 'readme',
  });

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (error || !catalog) {
    return (
      <Empty description="Catalog not found" style={{ padding: 120 }}>
        <Button onClick={() => navigate({ to: '/catalog' })}>
          Back to Catalogs
        </Button>
      </Empty>
    );
  }

  const openFile = (filePath: string) => {
    // Markdown defaults used to be Preview (read-only); must open Source to edit/save.
    setEditingViewMode('source');
    setEditingFiles((prev) =>
      prev.includes(filePath) ? prev : [...prev, filePath],
    );
    setActiveFile(filePath);
    setRightPanelMode('editor');
  };

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
        <CatalogHeader
          catalog={catalog}
          slug={slug}
          onShowDag={() => setRightPanelMode('preview')}
          onEditMetadata={() => setEditModalOpen(true)}
        />

        <CatalogMetaBar catalog={catalog} />
      </div>

      <EditCatalogModal
        open={editModalOpen}
        catalog={catalog}
        onCancel={() => setEditModalOpen(false)}
        onSuccess={() => setEditModalOpen(false)}
      />

      <div className="catalog-detail-content">
        <div className="catalog-file-panel">
          <CatalogFileTree
            catalog={catalog}
            slug={slug}
            onOpenFile={openFile}
          />
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
                {rightPanelMode === 'readme' && readmePath ? (
                  <Button
                    type="default"
                    size="small"
                    icon={<FileTextOutlined />}
                    onClick={() => openFile(readmePath)}
                  >
                    Open README
                  </Button>
                ) : null}
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
                  slug={slug}
                  openFiles={editingFiles}
                  activeFile={activeFile}
                  viewMode={editingViewMode}
                  onViewModeChange={setEditingViewMode}
                  onCloseAll={() => {
                    setEditingFiles([]);
                    setActiveFile('');
                    setRightPanelMode('readme');
                  }}
                  onClose={(filePath) =>
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
                    })
                  }
                  onActiveFileChange={setActiveFile}
                />
              ) : rightPanelMode === 'preview' ? (
                catalog?.has_snakefile ? (
                  <CatalogDagSvg slug={slug} />
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
                    No Snakefile found — add one to preview the DAG
                  </div>
                )
              ) : readmePath ? (
                isReadmeLoading ? (
                  <div style={{ textAlign: 'center', padding: 60 }}>
                    <Spin tip="Loading README..." />
                  </div>
                ) : (
                  <MarkdownViewer
                    content={readmeContentData?.content || ''}
                    fileName="README.md"
                  />
                )
              ) : (
                <Empty
                  description="No README.md found in this catalog"
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

export default CatalogDetail;
