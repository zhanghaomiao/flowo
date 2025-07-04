import { useEffect, useState } from "react";

import type { JobResponse, WorkflowResponse } from "../../api";
import { formatDuration } from "../../utils/formatters";

export const DurationCell: React.FC<{
  record: WorkflowResponse | JobResponse;
}> = ({ record }) => {
  const [currentTime, setCurrentTime] = useState(Date.now());

  useEffect(() => {
    // Only set up timer for running workflows
    if (record.status === "RUNNING" && record.started_at) {
      const timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000); // Update every second

      return () => clearInterval(timer);
    }
  }, [record.status, record.started_at]);

  if (record.status === "ERROR") {
    return <span>-</span>;
  }

  if (record.end_time && record.started_at) {
    const duration =
      new Date(record.end_time).getTime() -
      new Date(record.started_at).getTime();
    return <span>{formatDuration(duration)}</span>;
  } else if (record.started_at) {
    let endTime = record.end_time
      ? new Date(record.end_time).getTime()
      : currentTime;

    if (record.status === "RUNNING") {
      endTime = currentTime;
    }

    const duration = endTime - new Date(record.started_at).getTime();
    return <span>{formatDuration(duration)}</span>;
  }

  return <span>-</span>;
};
