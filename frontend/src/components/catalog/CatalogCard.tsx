import React, { useEffect, useState } from 'react';

import { useNavigate } from '@tanstack/react-router';
import { Button, Card, Tag, Tooltip, Typography } from 'antd';
import dayjs from 'dayjs';
import {
  Calendar,
  GitBranch,
  Layers,
  Pencil,
  Trash2,
  User,
} from 'lucide-react';

import type { CatalogSummary } from '@/client/types.gen';
import CopyIconButton from '@/components/shared/CopyIconButton';

const { Title, Paragraph, Text } = Typography;

/**
 * Helper to load images that require Authorization headers.
 */
const AuthImage: React.FC<{
  src: string;
  alt: string;
  className?: string;
  onStatus: (status: 'loading' | 'success' | 'error') => void;
}> = ({ src, alt, className, onStatus }) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('token');

    onStatus('loading');
    fetch(src, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load');
        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setObjectUrl(url);
        onStatus('success');
      })
      .catch(() => {
        if (!active) return;
        onStatus('error');
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!objectUrl) return null;
  return <img src={objectUrl} alt={alt} className={className} />;
};

interface Props {
  catalog: CatalogSummary;
  onDelete: () => void;
  onEdit: () => void;
}

/**
 * Modern card representation of a Catalog (Workflow).
 * Shows a mini DAG preview and key metadata.
 */
const MAX_TAGS_COLLAPSED = 4;

const CatalogCard: React.FC<Props> = ({ catalog, onDelete, onEdit }) => {
  const [loadStatus, setLoadStatus] = useState<'loading' | 'success' | 'error'>(
    'loading',
  );
  const [tagsExpanded, setTagsExpanded] = useState(false);
  const sourceUrl = catalog.source_url?.trim();
  const isGitSource = !!sourceUrl;
  const navigate = useNavigate();

  const dagUrl = `/api/v1/catalog/${catalog.slug}/dag/svg`;
  const tags = catalog.tags || [];
  const hiddenTagCount =
    tags.length > MAX_TAGS_COLLAPSED ? tags.length - MAX_TAGS_COLLAPSED : 0;
  const visibleTags = tagsExpanded ? tags : tags.slice(0, MAX_TAGS_COLLAPSED);

  const handleCardClick = () => {
    void navigate({
      to: '/catalog/$catalogSlug',
      params: { catalogSlug: catalog.slug ?? '' },
    });
  };

  useEffect(() => {
    setTagsExpanded(false);
  }, [catalog.slug]);

  return (
    <Card
      hoverable
      onClick={handleCardClick}
      className="group flex h-full flex-col overflow-hidden border-slate-200/80 transition-all duration-300 hover:border-indigo-300 hover:shadow-xl"
      styles={{
        body: {
          padding: '20px',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        },
        cover: {
          height: '180px',
          overflow: 'hidden',
          background: '#fcfdfe',
          borderBottom: '1px solid #f1f5f9',
          position: 'relative',
        },
      }}
      cover={
        <div className="relative flex h-full w-full items-center justify-center p-2">
          {/* Decorative subtle grid background */}
          <div className="absolute inset-0 opacity-[0.02] [background-image:linear-gradient(#6366f1_1px,transparent_1px),linear-gradient(90deg,#6366f1_1px,transparent_1px)] [background-size:20px_20px]" />

          <div className="z-10 flex h-full w-full items-center justify-center overflow-hidden">
            <AuthImage
              src={dagUrl}
              alt="DAG Preview"
              className={`max-h-[105%] max-w-[105%] object-contain transition-all duration-700 ${
                loadStatus === 'success'
                  ? 'scale-100 opacity-100 blur-0 group-hover:scale-105'
                  : 'scale-95 opacity-0 blur-sm'
              }`}
              onStatus={setLoadStatus}
            />

            {loadStatus !== 'success' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
                <Layers
                  size={40}
                  strokeWidth={1}
                  className="text-slate-200 group-hover:text-indigo-200 transition-colors"
                />
                <Text className="text-[10px] font-bold uppercase tracking-widest text-slate-400 opacity-40">
                  {loadStatus === 'loading' ? 'Loading...' : 'No Preview'}
                </Text>
              </div>
            )}
          </div>

          {/* Source Badge */}
          <div className="absolute top-3 left-3 z-20">
            <div className="flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-500 shadow-sm border border-slate-100/50 backdrop-blur-sm">
              {isGitSource ? (
                <GitBranch size={11} className="text-indigo-500" />
              ) : (
                <User size={11} className="text-emerald-500" />
              )}
              {isGitSource ? 'GIT' : 'LOCAL'}
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <Title
          level={5}
          className="!mb-0 truncate font-bold text-slate-800 transition-colors group-hover:text-indigo-600"
          style={{ fontSize: '15px' }}
        >
          {catalog.name}
        </Title>
        <Tag className="m-0 border-none bg-slate-100 px-1.5 py-0 text-[10px] font-bold text-slate-500">
          v{catalog.version}
        </Tag>
      </div>

      <Paragraph
        className="mb-4 flex-1 text-[12px] leading-relaxed text-slate-500"
        ellipsis={{ rows: 2 }}
      >
        {catalog.description || 'A Snakemake workflow managed by Flowo.'}
      </Paragraph>

      <div className="mt-auto flex items-center justify-between border-t border-slate-50 pt-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          {visibleTags.map((tag, i) => (
            <Tag
              key={`${tag}-${i}`}
              className="m-0 max-w-full shrink-0 border-none bg-indigo-50/50 px-1.5 py-0 text-[10px] font-medium text-indigo-500"
              title={tag}
            >
              <span className="inline-block max-w-[140px] truncate align-bottom">
                {tag}
              </span>
            </Tag>
          ))}
          {!tagsExpanded && hiddenTagCount > 0 && (
            <Tooltip title={`${hiddenTagCount} more — click to show all`}>
              <button
                type="button"
                className="inline-flex shrink-0 cursor-pointer items-center rounded border-none bg-slate-100 px-1.5 py-0 text-[10px] font-bold text-slate-500 transition-colors hover:bg-indigo-100 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setTagsExpanded(true);
                }}
              >
                +{hiddenTagCount}
              </button>
            </Tooltip>
          )}
          {tagsExpanded && tags.length > MAX_TAGS_COLLAPSED && (
            <button
              type="button"
              className="shrink-0 cursor-pointer text-[10px] font-semibold text-indigo-500 hover:text-indigo-700"
              onClick={(e) => {
                e.stopPropagation();
                setTagsExpanded(false);
              }}
            >
              Show less
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Tooltip title="Edit Metadata">
            <Button
              type="text"
              size="small"
              icon={<Pencil size={14} />}
              onClick={onEdit}
              className="text-slate-400 hover:bg-indigo-50 hover:text-indigo-600"
            />
          </Tooltip>
          <CopyIconButton
            text={
              catalog.slug?.trim()
                ? `flowo catalog download ${catalog.slug.trim()}`
                : ''
            }
            tooltip={`Copy: flowo catalog download ${catalog.slug ?? ''}`}
            disabled={!catalog.slug?.trim()}
            className="text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            iconSize={14}
          />
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={14} />}
              onClick={onDelete}
              className="text-slate-300 hover:bg-red-50 hover:text-red-500"
            />
          </Tooltip>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1 text-[9px] font-medium text-slate-400 opacity-60">
        <Calendar size={10} />
        <span>Updated {dayjs(catalog.updated_at).fromNow()}</span>
      </div>
    </Card>
  );
};

export default CatalogCard;
