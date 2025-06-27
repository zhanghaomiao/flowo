import { Card } from "antd";
import React, { useCallback, useEffect, useRef, useState } from "react";

const STATUS_COLORS = {
  unscheduled: "#E0E0E0",
  SUCCESS: "#C8E6C9",
  RUNNING: "#BBDEFB",
  ERROR: "#FFCDD2",
  WAITING: "#FFECB3",
};

const DraggableLegendPanel: React.FC = () => {
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
    e.preventDefault();
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y,
        });
      }
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      return () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        left: position.x,
        top: position.y,
        zIndex: 1000,
        cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none",
      }}
      onMouseDown={handleMouseDown}
    >
      <Card
        size="small"
        style={{
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          border: "1px solid #d9d9d9",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div
              key={status}
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: color,
                  borderRadius: "2px",
                  border: "1px solid #d9d9d9",
                }}
              />
              <span style={{ fontSize: "10px", color: "#666" }}>
                {status === "unscheduled" ? "Unscheduled" : status}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default DraggableLegendPanel;
