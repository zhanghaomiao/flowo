import React from 'react';

import { Tag } from 'antd';

import { getTagColor } from '@/utils/tagColors';

interface WorkflowTagProps {
  tag: string;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (tag: string) => void;
}

const WorkflowTag: React.FC<WorkflowTagProps> = ({
  tag,
  style,
  className,
  onClick,
}) => {
  const handleClick = () => {
    if (onClick) {
      onClick(tag);
    }
  };

  return (
    <Tag
      color={getTagColor(tag)}
      className={className}
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
