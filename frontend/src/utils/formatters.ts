import type { Status } from '@/client/types.gen';

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

// Get status color for workflow Status enum
export const getStatusColor = (status: Status) => {
  switch (status) {
    case 'SUCCESS':
      return 'green';
    case 'RUNNING':
      return 'blue';
    case 'ERROR':
      return 'red';
    case 'WAITING':
      return 'orange';
    default:
      return 'default';
  }
};

export const getWorkflowProgressPercent = (status: Status) => {
  switch (status) {
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

export const getWorkflowProgressStatus = (status: Status) => {
  switch (status) {
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
