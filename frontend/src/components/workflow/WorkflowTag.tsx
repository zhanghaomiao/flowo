import React from 'react';

import { Tag as TagIcon } from 'lucide-react';

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
  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.stopPropagation();
      onClick(tag);
    }
  };

  return (
    <span
      className={`m-0 !inline-flex max-w-full !items-center gap-1 whitespace-nowrap rounded-full border border-indigo-100 bg-indigo-50/50 px-2 py-0.5 text-[10px] font-bold tracking-tight text-indigo-600 shadow-sm transition-all duration-200 hover:border-indigo-200 hover:bg-indigo-100 hover:text-indigo-700 ${className ?? ''}`}
      style={{
        ...(style as React.CSSProperties),
        cursor: onClick ? 'pointer' : 'default',
      }}
      onClick={handleClick}
    >
      <TagIcon size={10} strokeWidth={2.5} className="shrink-0 opacity-70" />
      <span className="truncate">{tag}</span>
    </span>
  );
};

export default WorkflowTag;
