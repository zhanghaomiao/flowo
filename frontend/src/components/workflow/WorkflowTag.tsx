import { getTagColor } from '@/utils/tagColors';
import { Tag } from 'antd';
import React from 'react';

interface WorkflowTagProps {
  tag: string;
  style?: React.CSSProperties;
  onClick?: (tag: string) => void;
}

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
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      {tag}
    </Tag>
  );
};

export default WorkflowTag;
