import type { Status } from "../api/api";

// Format date for display with consistent formatting
export const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return dateString;
  }
};

// Alternative format with custom padding (used in JobTable)
export const formatDateCompact = (dateString: string | null) => {
  if (!dateString) return "-";
  try {
    const date = new Date(dateString);
    const pad = (n: number) => String(n).padStart(2, "0");

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
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

// Get status color for workflow Status enum
export const getStatusColor = (status: Status) => {
  switch (status) {
    case "SUCCESS":
      return "green";
    case "RUNNING":
      return "blue";
    case "ERROR":
      return "red";
    case "WAITING":
      return "orange";
    default:
      return "default";
  }
};

// Get progress percentage for workflow status
export const getWorkflowProgressPercent = (status: Status) => {
  switch (status) {
    case "SUCCESS":
      return 100;
    case "RUNNING":
    case "ERROR":
    case "WAITING":
      return 0;
    default:
      return 0;
  }
};

// Get progress status for workflow
export const getWorkflowProgressStatus = (status: Status) => {
  switch (status) {
    case "SUCCESS":
      return "success";
    case "RUNNING":
      return "active";
    case "ERROR":
      return "exception";
    default:
      return "normal";
  }
};
