import type { NodeProps } from "@xyflow/react";
import { Handle, Position } from "@xyflow/react";
import { Space, Tooltip } from "antd";
import React, { memo } from "react";

// Multi-progress bar component for showing job status breakdown
const MultiProgressBar = ({
  total,
  success,
  running,
  error,
}: {
  total: number;
  success: number;
  running: number;
  error: number;
}) => {
  const waiting = total - success - running - error;
  const successPercent = (success / total) * 100;
  const runningPercent = (running / total) * 100;
  const errorPercent = (error / total) * 100;
  const waitingPercent = (waiting / total) * 100;

  return (
    <div style={{ display: "flex", alignItems: "center", width: "100%" }}>
      <div
        style={{
          display: "flex",
          width: "100%",
          height: 8,
          borderRadius: 0,
          overflow: "hidden",
          border: "1px solid #000000",
        }}
      >
        {success > 0 && (
          <Tooltip title={`Success: ${success}`}>
            <div
              style={{ width: `${successPercent}%`, background: "#37a460" }}
            />
          </Tooltip>
        )}
        {running > 0 && (
          <Tooltip title={`Running: ${running}`}>
            <div
              style={{ width: `${runningPercent}%`, background: "#85d2ab" }}
            />
          </Tooltip>
        )}
        {error > 0 && (
          <Tooltip title={`Error: ${error}`}>
            <div style={{ width: `${errorPercent}%`, background: "#f5222d" }} />
          </Tooltip>
        )}
        {waiting > 0 && (
          <Tooltip title={`Waiting: ${waiting}`}>
            <div
              style={{ width: `${waitingPercent}%`, background: "#d9d9d9" }}
            />
          </Tooltip>
        )}
      </div>
    </div>
  );
};

// Define interface for the custom node data
interface ProgressNodeData {
  rule: string;
  value: string;
  statusInfo?: {
    status: string;
    total: number;
    success: number;
    running: number;
    error: number;
  } | null;
  isSelected: boolean;
  isHighlighted: boolean;
  isUnscheduled: boolean;
  backgroundColor: string;
  textColor: string;
  borderColor: string;
  boxShadow: string;
  layoutDirection: string;
}

// Custom React Flow node component
const ProgressNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as unknown as ProgressNodeData;
  const {
    rule,
    statusInfo,
    isUnscheduled,
    backgroundColor,
    textColor,
    borderColor,
    boxShadow,
    layoutDirection,
  } = nodeData;

  const isHorizontal = layoutDirection === "LR";

  return (
    <div
      style={{
        background: backgroundColor,
        color: textColor,
        border: `2px solid ${borderColor}`,
        borderRadius: "8px",
        padding: "12px",
        minWidth: "160px",
        minHeight: "60px",
        boxShadow,
        cursor: isUnscheduled ? "not-allowed" : "pointer",
        opacity: isUnscheduled ? 0.6 : 1,
        transition: "all 0.2s ease",
        fontSize: "12px",
        fontWeight: "500",
      }}
    >
      {/* Target Handle */}
      <Handle
        type="target"
        position={isHorizontal ? Position.Left : Position.Top}
        style={{
          background: borderColor,
          border: `2px solid ${backgroundColor}`,
          width: 8,
          height: 8,
        }}
      />

      {/* Node Content */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "4px",
          alignItems: "flex-start",
          justifyContent: "center",
          textAlign: "left",
        }}
      >
        {/* Rule Name */}
        <Tooltip title={`Rule: ${rule}`} placement="top">
          <div
            style={{
              fontWeight: "bold",
              fontSize: "12px",
              lineHeight: "1.2",
              wordBreak: "break-word",
              maxWidth: "130px",
            }}
          >
            {rule}  ({statusInfo?.total})
          </div>
        </Tooltip>

        {/* Progress Bar - only show if statusInfo is available */}
        {statusInfo && statusInfo.total > 0 && (
          <div style={{ width: "100%", marginTop: "4px" }}>
            <MultiProgressBar
              total={statusInfo.total}
              success={statusInfo.success}
              running={statusInfo.running}
              error={statusInfo.error}
            />
          </div>
        )}

        {/* Status indicator for unscheduled nodes */}
        {isUnscheduled && (
          <div
            style={{
              fontSize: "10px",
              color: "#999",
              fontStyle: "italic",
            }}
          >
            Unscheduled
          </div>
        )}
      </div>

      {/* Source Handle */}
      <Handle
        type="source"
        position={isHorizontal ? Position.Right : Position.Bottom}
        style={{
          background: borderColor,
          border: `2px solid ${backgroundColor}`,
          width: 8,
          height: 8,
        }}
      />
    </div>
  );
};

// Memoize the component to prevent unnecessary re-renders
export default memo(ProgressNode);

// Also export the MultiProgressBar for potential standalone use
export { MultiProgressBar };
