import React, { useEffect, useState } from 'react';

import {
  ApartmentOutlined,
  CodeOutlined,
  EyeOutlined,
  FileOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { Button, Empty, message, Spin } from 'antd';

import {
  deleteFileMutation,
  getCatalogOptions,
  getCatalogQueryKey,
  readFile2Options,
} from '@/client/@tanstack/react-query.gen';

import './CatalogDetail.css';

import Dag from '../job/dag/Dag';
import { type GraphData } from '../job/dag/useDag';
import CodeViewer from '../shared/viewers/CodeViewer';

import CatalogEditor from './CatalogEditor';
import CatalogFileTree from './detail/CatalogFileTree';
import CatalogFooter from './detail/CatalogFooter';
import CatalogHeader from './detail/CatalogHeader';

interface Props {
  slug: string;
}

const CatalogDetail: React.FC<Props> = ({ slug }) => {
  const [messageApi, contextHolder] = message.useMessage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    data: catalog,
    isLoading,
    error,
  } = useQuery({
    ...getCatalogOptions({ path: { slug } }),
    enabled: !!slug && slug !== '{slug}',
  });

  const deleteFileMut = useMutation(deleteFileMutation());

  // Editor state
  const [editingFiles, setEditingFiles] = useState<string[]>([]);
  const [activeFile, setActiveFile] = useState<string>('');

  // Right panel mode: 'readme', 'preview' (DAG), or 'editor'
  const [rightPanelMode, setRightPanelMode] = useState<
    'preview' | 'editor' | 'readme'
  >('readme');

  // README state
  const [readmePath, setReadmePath] = useState<string | null>(null);

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
    setEditingFiles((prev) =>
      prev.includes(filePath) ? prev : [...prev, filePath],
    );
    setActiveFile(filePath);
    setRightPanelMode('editor');
  };

  const handleDeleteFile = async (filePath: string) => {
    await deleteFileMut.mutateAsync({ path: { file_path: filePath, slug } });
    queryClient.invalidateQueries({
      queryKey: getCatalogQueryKey({ path: { slug } }),
    });
    messageApi.success('File deleted');
    setEditingFiles((prev) => {
      const next = prev.filter((f) => f !== filePath);
      if (activeFile === filePath) {
        if (next.length > 0) {
          setActiveFile(next[next.length - 1]);
        } else {
          setActiveFile('');
          setRightPanelMode('readme');
        }
      }
      return next;
    });
  };

  const handleDeleteFolder = (path: string) => {
    setEditingFiles((prev) => {
      const next = prev.filter((f) => !f.startsWith(`${path}/`) && f !== path);
      if (activeFile === path || activeFile.startsWith(`${path}/`)) {
        if (next.length > 0) {
          setActiveFile(next[next.length - 1]);
        } else {
          setActiveFile('');
          setRightPanelMode('readme');
        }
      }
      return next;
    });
  };

  const handleRenameFiles = (oldPath: string, newPath: string) => {
    setEditingFiles((prev) =>
      prev.map((f) =>
        f === oldPath || f.startsWith(`${oldPath}/`)
          ? f.replace(oldPath, newPath)
          : f,
      ),
    );
    if (activeFile === oldPath || activeFile.startsWith(`${oldPath}/`)) {
      setActiveFile(activeFile.replace(oldPath, newPath));
    }
  };

  return (
    <div style={{ margin: '0 auto', padding: '16px 24px' }}>
      {contextHolder}

      <CatalogHeader
        catalog={catalog}
        slug={slug}
        onShowDag={() => setRightPanelMode('preview')}
      />

      <div className="catalog-detail-content">
        <div className="catalog-file-panel">
          <CatalogFileTree
            catalog={catalog}
            slug={slug}
            onOpenFile={openFile}
            onDeleteFile={handleDeleteFile}
            onDeleteFolder={handleDeleteFolder}
            onRenameFiles={handleRenameFiles}
          />
          <CatalogFooter catalog={catalog} />
        </div>

        <div className="catalog-editor-panel">
          <div className="catalog-panel-header">
            <span className="catalog-panel-title">
              {rightPanelMode === 'editor' ? (
                <>
                  <CodeOutlined /> Editor
                </>
              ) : rightPanelMode === 'preview' ? (
                <>
                  <ApartmentOutlined /> DAG Preview
                </>
              ) : (
                <>
                  <InfoCircleOutlined /> Overview
                </>
              )}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {rightPanelMode !== 'readme' && (
                <Button
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => setRightPanelMode('readme')}
                >
                  View README
                </Button>
              )}
              {rightPanelMode === 'editor' && editingFiles.length > 0 && (
                <Button
                  size="small"
                  type="text"
                  icon={<FileOutlined />}
                  onClick={() => setRightPanelMode('editor')}
                  style={{ fontWeight: 600 }}
                >
                  {activeFile.split('/').pop()}
                </Button>
              )}
            </div>
          </div>

          <div className="catalog-panel-body">
            {rightPanelMode === 'editor' ? (
              <CatalogEditor
                slug={slug}
                openFiles={editingFiles}
                activeFile={activeFile}
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
                    }
                    return next;
                  })
                }
              />
            ) : rightPanelMode === 'preview' ? (
              catalog?.has_snakefile ? (
                <Dag
                  catalogSlug={slug}
                  initialData={catalog.rulegraph_data as unknown as GraphData}
                />
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
                <CodeViewer
                  content={readmeContentData?.content || ''}
                  fileName="README.md"
                  fileFormat="md"
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
  );
};

export default CatalogDetail;
