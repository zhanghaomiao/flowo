import type { Status } from '@/client/types.gen';

/** Normalize API / ORM status strings (e.g. ``Status.SUCCESS``) to client ``Status``. */
export function normalizeWorkflowStatus(
  raw: string | null | undefined,
): Status {
  if (!raw) return 'UNKNOWN';
  const t = raw.trim();
  if (t.includes('.')) {
    const last = t.split('.').pop()!.toUpperCase();
    if (
      last === 'SUCCESS' ||
      last === 'RUNNING' ||
      last === 'ERROR' ||
      last === 'WAITING' ||
      last === 'UNKNOWN'
    ) {
      return last as Status;
    }
  }
  const u = t.toUpperCase();
  if (
    u === 'SUCCESS' ||
    u === 'RUNNING' ||
    u === 'ERROR' ||
    u === 'WAITING' ||
    u === 'UNKNOWN'
  ) {
    return u as Status;
  }
  return 'UNKNOWN';
}

const WORKFLOW_STATUS_LABELS: Record<Status, string> = {
  SUCCESS: 'Succeeded',
  RUNNING: 'Running',
  ERROR: 'Failed',
  WAITING: 'Waiting',
  UNKNOWN: 'Unknown',
};

export function workflowStatusLabel(status: Status): string {
  return WORKFLOW_STATUS_LABELS[status] ?? status;
}

/** Ant Design ``Badge`` ``status`` prop for workflow rows. */
export function workflowBadgeAntStatus(
  status: Status | string | null | undefined,
): 'success' | 'processing' | 'error' | 'default' | 'warning' {
  const s = normalizeWorkflowStatus(status ?? undefined);
  switch (s) {
    case 'SUCCESS':
      return 'success';
    case 'RUNNING':
      return 'processing';
    case 'ERROR':
      return 'error';
    case 'WAITING':
      return 'warning';
    default:
      return 'default';
  }
}

export const formatDate = (dateString: string | null) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return dateString;
  }
};

// Alternative format with custom padding (used in JobTable)
export const formatDateCompact = (dateString: string | null) => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    const pad = (n: number) => String(n).padStart(2, '0');

    const year = date.getFullYear();
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  } catch {
    return dateString;
  }
};

export const formatDuration = (duration: number) => {
  // Handle negative durations or invalid values
  if (duration < 0 || !Number.isFinite(duration)) {
    return '00:00:00';
  }

  const hours = Math.floor(duration / 3600000);
  const minutes = Math.floor((duration % 3600000) / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
};

// Tag/dot color for workflow (and job) status — normalizes ORM-style strings.
export const getStatusColor = (
  status: Status | string | null | undefined,
): string => {
  const s = normalizeWorkflowStatus(status ?? undefined);
  switch (s) {
    case 'SUCCESS':
      return '#0ea5e9'; // Theme Sky Blue
    case 'RUNNING':
      return '#6366f1'; // Indigo for contrast
    case 'ERROR':
      return '#f43f5e'; // Rose
    case 'WAITING':
      return '#f59e0b'; // Amber
    default:
      return '#94a3b8'; // Slate
  }
};

export const getWorkflowProgressPercent = (
  status: Status | string | null | undefined,
) => {
  const s = normalizeWorkflowStatus(status ?? undefined);
  switch (s) {
    case 'SUCCESS':
      return 100;
    case 'RUNNING':
    case 'ERROR':
    case 'WAITING':
      return 0;
    default:
      return 0;
  }
};

export const getWorkflowProgressStatus = (
  status: Status | string | null | undefined,
) => {
  const s = normalizeWorkflowStatus(status ?? undefined);
  switch (s) {
    case 'SUCCESS':
      return 'success';
    case 'RUNNING':
      return 'active';
    case 'ERROR':
      return 'exception';
    default:
      return 'normal';
  }
};
