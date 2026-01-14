import { useEffect, useState } from 'react';

import type { JobResponse, WorkflowResponse } from '../../api';
import { formatDuration } from '../../utils/formatters';

// Utility function to calculate duration in milliseconds
export const calculateDuration = (
  record: WorkflowResponse | JobResponse,
  currentTime?: number,
): number => {
  if (record.status === 'ERROR') {
    return Infinity;
  }

  if (record.end_time && record.started_at) {
    return (
      new Date(record.end_time).getTime() -
      new Date(record.started_at).getTime()
    );
  } else if (record.started_at) {
    let endTime = record.end_time
      ? new Date(record.end_time).getTime()
      : currentTime || Date.now();

    if (record.status === 'RUNNING') {
      endTime = currentTime || Date.now();
    }

    return endTime - new Date(record.started_at).getTime();
  }

  return 0;
};

export const DurationCell: React.FC<{
  record: WorkflowResponse | JobResponse;
}> = ({ record }) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Only set up timer for running workflows
    if (record.status === 'RUNNING' && record.started_at) {
      const timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000); // Update every second

      return () => clearInterval(timer);
    }
  }, [record.status, record.started_at]);

  const duration = calculateDuration(record, currentTime);

  if (record.status === 'ERROR') {
    return <span>-</span>;
  }

  if (duration === 0 && !record.started_at) {
    return <span>-</span>;
  }

  return <span>{formatDuration(duration)}</span>;
};
