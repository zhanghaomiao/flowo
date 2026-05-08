import React, { useMemo, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import {
  Button,
  Form,
  Input,
  message,
  Modal,
  Table,
  Tag,
  Tooltip,
  Typography,
} from 'antd';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import {
  AlertCircle,
  CheckCircle,
  CloudUpload,
  Download,
  FileText,
  GitBranch,
  Loader2,
  Search,
  Trash2,
  User,
} from 'lucide-react';

import {
  deleteCatalogMutation,
  getSettingsOptions,
  gitPushMutation,
  importFromGitMutation,
  listCatalogsQueryKey,
  useListCatalogsQuery,
} from '@/client/@tanstack/react-query.gen';
import { getSettings } from '@/client/sdk.gen';
import type { CatalogSummary } from '@/client/types.gen';
import { downloadFile } from '@/utils/download';

dayjs.extend(relativeTime);

type GitBackupResult = {
  status: 'success' | 'error' | 'running';
  message?: string;
  runId?: string;
  branch?: string;
  commitSha?: string;
};

type GitBackupPayload = {
  run_id?: string;
  status?: string;
  message?: string;
  branch?: string;
  commit_sha?: string;
};

function readGitBackupFromSettings(
  data: unknown,
): GitBackupPayload | undefined {
  if (!data || typeof data !== 'object' || !('extra' in data)) {
    return undefined;
  }
  const extra = (data as { extra?: { git_backup?: GitBackupPayload } }).extra;
  return extra?.git_backup;
}

function toBackupResult(
  p: GitBackupPayload | undefined,
): GitBackupResult | null {
  if (!p?.status) return null;
  if (
    p.status !== 'success' &&
    p.status !== 'error' &&
    p.status !== 'running'
  ) {
    return null;
  }
  return {
    status: p.status,
    message: p.message,
    runId: p.run_id,
    branch: p.branch,
    commitSha: p.commit_sha,
  };
}

/** Best-effort HTTPS (or existing http) URL for opening the configured Git remote in a browser. */
function browserOpenableGitRemote(
  raw: string | null | undefined,
): string | null {
  const u = raw?.trim();
  if (!u) return null;
  if (/^https?:\/\//i.test(u)) return u;
  const m = u.match(/^git@([^:]+):(.+)$/);
  if (m) {
    const host = m[1];
    const path = m[2].replace(/\.git$/i, '');
    return `https://${host}/${path}`;
  }
  if (/^ssh:\/\/git@/i.test(u)) {
    const inner = u.replace(/^ssh:\/\/git@/i, '');
    const slash = inner.indexOf('/');
    if (slash > 0) {
      const host = inner.slice(0, slash);
      const path = inner.slice(slash + 1).replace(/\.git$/i, '');
      return `https://${host}/${path}`;
    }
  }
  return null;
}

type GitSyncStatusBadgeProps = {
  displayBackup: GitBackupResult;
  gitRemoteBrowserUrl: string | null;
  gitRemoteRaw?: string | null;
};

function GitSyncStatusBadge({
  displayBackup,
  gitRemoteBrowserUrl,
  gitRemoteRaw,
}: GitSyncStatusBadgeProps) {
  const canOpenRemote =
    displayBackup.status === 'success' && !!gitRemoteBrowserUrl;
  const badgeClass = `inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
    displayBackup.status === 'success'
      ? 'bg-emerald-50 text-emerald-600'
      : displayBackup.status === 'error'
        ? 'bg-red-50 text-red-600'
        : 'bg-blue-50 text-blue-600'
  }`;
  const icon =
    displayBackup.status === 'success' ? (
      <CheckCircle size={18} />
    ) : displayBackup.status === 'error' ? (
      <AlertCircle size={18} />
    ) : (
      <Loader2 size={18} className="animate-spin" />
    );
  return (
    <Tooltip
      title={
        <div className="space-y-1 text-left">
          {canOpenRemote && (
            <div className="font-medium">Click to open sync repository</div>
          )}
          <div>Status: {displayBackup.status}</div>
          {displayBackup.commitSha && (
            <div>Commit: {displayBackup.commitSha}</div>
          )}
          {displayBackup.branch && <div>Branch: {displayBackup.branch}</div>}
          {displayBackup.message && <div>{displayBackup.message}</div>}
          {displayBackup.runId && (
            <div className="text-xs">Run: {displayBackup.runId}</div>
          )}
          {gitRemoteRaw &&
            displayBackup.status === 'success' &&
            !gitRemoteBrowserUrl && (
              <div className="text-xs opacity-90">Remote: {gitRemoteRaw}</div>
            )}
        </div>
      }
    >
      {canOpenRemote ? (
        <a
          href={gitRemoteBrowserUrl!}
          target="_blank"
          rel="noreferrer"
          className={`${badgeClass} cursor-pointer no-underline transition-opacity hover:opacity-90`}
          aria-label="Open Git sync repository in browser"
        >
          {icon}
        </a>
      ) : (
        <span
          className={badgeClass}
          aria-label={`Git sync ${displayBackup.status}`}
        >
          {icon}
        </span>
      )}
    </Tooltip>
  );
}

export default function CatalogList() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [importGitOpen, setImportGitOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingCatalog, setDeletingCatalog] = useState<CatalogSummary | null>(
    null,
  );
  const [backupLoading, setBackupLoading] = useState(false);
  const [backupResult, setBackupResult] = useState<GitBackupResult | null>(
    null,
  );
  const [gitImportForm] = Form.useForm();

  const { data: catalogs, isLoading } = useListCatalogsQuery({
    query: { search: search || undefined },
  });

  const { data: settings } = useQuery({
    ...getSettingsOptions(),
    refetchInterval: (q) => {
      const st = readGitBackupFromSettings(q.state.data)?.status;
      return st === 'running' ? 2000 : false;
    },
  });

  const deleteMutation = useMutation(deleteCatalogMutation());
  const importGitMutation = useMutation(importFromGitMutation());
  const gitPushMut = useMutation(gitPushMutation());

  const hasGitRemote = !!settings?.git_remote_url;
  const gitBackupStatus = readGitBackupFromSettings(settings)?.status as
    | 'running'
    | 'success'
    | 'error'
    | undefined;
  const isGitBackupRunning = gitBackupStatus === 'running';

  const serverBackupResult = useMemo(
    () => toBackupResult(readGitBackupFromSettings(settings)),
    [settings],
  );

  const displayBackup = backupResult ?? serverBackupResult;

  const gitRemoteBrowserUrl = useMemo(
    () => browserOpenableGitRemote(settings?.git_remote_url),
    [settings?.git_remote_url],
  );

  const handleImportFromGit = async () => {
    try {
      const values = await gitImportForm.validateFields();
      await importGitMutation.mutateAsync({
        body: {
          git_url: values.git_url,
          token: values.token || null,
          subdirectory: values.subdirectory || null,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: listCatalogsQueryKey({}),
      });
      message.success('Successfully imported from Git');
      setImportGitOpen(false);
      gitImportForm.resetFields();
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to import from Git';
      message.error(errorMsg);
    }
  };

  const handleDelete = async () => {
    if (!deletingCatalog) return;
    try {
      await deleteMutation.mutateAsync({
        path: { slug: deletingCatalog.slug ?? '' },
      });
      await queryClient.invalidateQueries({
        queryKey: listCatalogsQueryKey({}),
      });
      message.success('Catalog deleted');
      setDeleteModalOpen(false);
      setDeletingCatalog(null);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : 'Failed to delete catalog';
      message.error(errorMsg);
    }
  };

  const handleGitBackup = async () => {
    const messageKey = 'catalog-git-backup';
    try {
      setBackupLoading(true);
      setBackupResult(null);
      message.loading({
        key: messageKey,
        content: 'Syncing catalogs to Git…',
        duration: 0,
      });

      const res = (await gitPushMut.mutateAsync({ body: {} })) as
        | { run_id?: string }
        | undefined;
      const runId = res?.run_id;

      for (let i = 0; i < 30; i++) {
        if (i > 0) {
          await new Promise((r) => setTimeout(r, 2000));
        }
        const { data } = await getSettings({ throwOnError: true });
        const backup = readGitBackupFromSettings(data);
        const currentRunId = backup?.run_id as string | undefined;
        const st = backup?.status as string | undefined;
        if (runId && currentRunId !== runId) {
          continue;
        }

        if (st === 'success') {
          const result: GitBackupResult = {
            status: 'success',
            message: backup?.message as string | undefined,
            runId: currentRunId,
            branch: backup?.branch as string | undefined,
            commitSha: backup?.commit_sha as string | undefined,
          };
          const sha = result.commitSha?.slice(0, 8);
          const fallback =
            sha && result.branch ? `${sha} on ${result.branch}` : 'completed';
          message.destroy(messageKey);
          setBackupResult(result);
          message.success({
            key: messageKey,
            content: `Synced to Git: ${result.message || fallback}`,
            duration: 4,
          });
          await queryClient.invalidateQueries({
            queryKey: getSettingsOptions().queryKey,
          });
          break;
        }
        if (st === 'error') {
          const result: GitBackupResult = {
            status: 'error',
            message: backup?.message as string | undefined,
            runId: currentRunId,
            branch: backup?.branch as string | undefined,
            commitSha: backup?.commit_sha as string | undefined,
          };
          message.destroy(messageKey);
          setBackupResult(result);
          message.error({
            key: messageKey,
            content: `Git sync failed: ${result.message || 'unknown error'}`,
            duration: 6,
          });
          await queryClient.invalidateQueries({
            queryKey: getSettingsOptions().queryKey,
          });
          break;
        }

        if (i === 29) {
          message.warning({
            key: messageKey,
            content: 'Git sync is still running. Check again shortly.',
            duration: 5,
          });
          setBackupResult({ status: 'running', runId });
        }
      }
    } catch (e: unknown) {
      message.destroy(messageKey);
      const msg = e instanceof Error ? e.message : 'Git sync failed';
      setBackupResult({ status: 'error', message: msg });
      message.error({ key: messageKey, content: msg, duration: 6 });
    } finally {
      setBackupLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: CatalogSummary) => {
        const sourceUrl = record.source_url?.trim();
        const isGitSource = !!sourceUrl;
        return (
          <div className="flex items-center gap-2">
            <Tooltip
              title={isGitSource ? 'Git-backed catalog' : 'Local catalog'}
            >
              <span className="text-slate-500">
                {isGitSource ? <GitBranch size={16} /> : <User size={16} />}
              </span>
            </Tooltip>
            <Link
              to="/catalog/$catalogSlug"
              params={{ catalogSlug: record.slug ?? '' }}
              className="font-medium text-slate-800 hover:text-indigo-600"
            >
              {name}
            </Link>
            <Tag color="blue" className="text-xs">
              v{record.version}
            </Tag>
          </div>
        );
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      render: (description: string | undefined) => {
        const d = (description ?? '').trim();
        if (!d) {
          return <span className="text-slate-400">—</span>;
        }
        return (
          <Typography.Text ellipsis={{ tooltip: d }} className="max-w-md">
            {d}
          </Typography.Text>
        );
      },
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags: string[] | undefined) =>
        (tags || []).length === 0 ? (
          <span className="text-slate-400">—</span>
        ) : (
          (tags || []).slice(0, 3).map((tag) => (
            <Tag key={tag} color="geekblue" className="text-xs">
              {tag}
            </Tag>
          ))
        ),
    },
    {
      title: 'Updated',
      dataIndex: 'updated_at',
      key: 'updated_at',
      width: 140,
      render: (date: string) => dayjs(date).fromNow(),
      sorter: (a: CatalogSummary, b: CatalogSummary) =>
        dayjs(a.updated_at).unix() - dayjs(b.updated_at).unix(),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '',
      key: 'actions',
      width: 100,
      align: 'right' as const,
      render: (_: unknown, record: CatalogSummary) => (
        <div className="flex items-center justify-end gap-1">
          <Tooltip title="Download">
            <Button
              type="text"
              size="small"
              icon={<Download size={16} />}
              onClick={async () => {
                try {
                  await downloadFile(
                    `/api/v1/catalog/${record.slug}/download`,
                    `${record.slug}.tar.gz`,
                  );
                } catch {
                  message.error('Download failed');
                }
              }}
              className="!h-8 !w-8 !p-0"
            />
          </Tooltip>
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<Trash2 size={16} />}
              onClick={() => {
                setDeletingCatalog(record);
                setDeleteModalOpen(true);
              }}
              className="!h-8 !w-8 !p-0"
            />
          </Tooltip>
        </div>
      ),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      {/* Page Header */}
      <div className="flex shrink-0 flex-col gap-4 border-b border-slate-100 px-6 py-5 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="shrink-0">
          <h1 className="text-xl font-bold text-slate-900">Workflows</h1>
          <p className="mt-1 text-sm text-slate-500">
            {catalogs?.length || 0} catalogs available
          </p>
        </div>
        <div className="flex min-w-0 w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 lg:max-w-3xl lg:flex-1">
          <Input
            placeholder="Search workflows..."
            prefix={<Search size={16} className="text-slate-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-full min-w-0 sm:max-w-xs md:max-w-sm"
            allowClear
          />
          <div className="flex shrink-0 flex-nowrap items-center justify-start gap-2 overflow-x-auto pb-0.5 sm:justify-end">
            <Button
              icon={<FileText size={16} />}
              className="shrink-0"
              onClick={() => navigate({ to: '/catalog/template' })}
            >
              Template
            </Button>
            <Tooltip
              title={
                hasGitRemote
                  ? 'Push all catalogs to your configured Git remote'
                  : 'Configure Git remote in Settings first'
              }
            >
              <Button
                icon={<CloudUpload size={16} />}
                className="shrink-0"
                disabled={
                  !hasGitRemote ||
                  backupLoading ||
                  gitPushMut.isPending ||
                  isGitBackupRunning
                }
                loading={
                  backupLoading || gitPushMut.isPending || isGitBackupRunning
                }
                onClick={() => {
                  void handleGitBackup();
                }}
              >
                {backupLoading || gitPushMut.isPending || isGitBackupRunning
                  ? 'Syncing…'
                  : 'Sync to Git'}
              </Button>
            </Tooltip>
            {displayBackup && (
              <GitSyncStatusBadge
                displayBackup={displayBackup}
                gitRemoteBrowserUrl={gitRemoteBrowserUrl}
                gitRemoteRaw={settings?.git_remote_url}
              />
            )}
            <Button
              type="primary"
              icon={<GitBranch size={18} />}
              className="shrink-0"
              onClick={() => setImportGitOpen(true)}
            >
              Import Workflow
            </Button>
          </div>
        </div>
      </div>

      {/* Table Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        <Table
          dataSource={catalogs || []}
          columns={columns}
          rowKey="slug"
          loading={isLoading}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: 'No workflows found. Import your first one!' }}
          className="bg-white"
        />
      </div>

      {/* Import from Git Modal */}
      <Modal
        title="Import Workflow from Git"
        open={importGitOpen}
        onOk={handleImportFromGit}
        onCancel={() => {
          setImportGitOpen(false);
          gitImportForm.resetFields();
        }}
        confirmLoading={importGitMutation.isPending}
        okText="Import"
      >
        <Form form={gitImportForm} layout="vertical" className="mt-4">
          <Form.Item
            name="git_url"
            label="Git Repository URL"
            rules={[{ required: true, message: 'Please enter a Git URL' }]}
          >
            <Input placeholder="https://github.com/your-org/workflow" />
          </Form.Item>
          <Form.Item
            name="subdirectory"
            label="Subdirectory (optional)"
            extra="Only import from a specific subdirectory"
          >
            <Input placeholder="e.g. workflows/rnaseq" />
          </Form.Item>
          <Form.Item
            name="token"
            label="Access Token (optional)"
            extra="Required for private repositories"
          >
            <Input.Password placeholder="ghp_..." autoComplete="off" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete Workflow"
        open={deleteModalOpen}
        onOk={handleDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setDeletingCatalog(null);
        }}
        confirmLoading={deleteMutation.isPending}
        okText="Delete"
        okType="danger"
      >
        <p>
          Are you sure you want to delete{' '}
          <strong>{deletingCatalog?.name}</strong>?
        </p>
        <p className="text-slate-500 text-sm mt-2">
          This will permanently delete the workflow and all its files.
        </p>
      </Modal>
    </div>
  );
}
