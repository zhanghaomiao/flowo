import { Tag } from "antd";
import React from "react";

interface WorkflowTagProps {
  tag: string;
  style?: React.CSSProperties;
  onClick?: (tag: string) => void;
}

// Function to generate consistent colors for tags
const getTagColor = (tag: string): string => {
  const colors = [
    "blue",
    "green",
    "orange",
    "red",
    "purple",
    "cyan",
    "magenta",
    "lime",
    "gold",
    "volcano",
    "geekblue",
    "pink",
  ];

  // Simple hash function to ensure same tag always gets same color
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    const char = tag.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return colors[Math.abs(hash) % colors.length];
};

const WorkflowTag: React.FC<WorkflowTagProps> = ({ tag, style, onClick }) => {
  const handleClick = () => {
    if (onClick) {
      onClick(tag);
    }
  };

  return (
    <Tag
      color={getTagColor(tag)}
      style={{
        ...style,
        marginInlineEnd: 2,
        cursor: onClick ? "pointer" : "default",
      }}
      onClick={handleClick}
    >
      {tag}
    </Tag>
  );
};

export default WorkflowTag;
