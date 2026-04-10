import React, { useEffect, useState } from 'react';

import { useQuery } from '@tanstack/react-query';
import type { TimeRangePickerProps } from 'antd';
import { DatePicker, Input, Select } from 'antd';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import { Calendar, Search, Tag } from 'lucide-react';

import { getAllTagsOptions } from '@/client/@tanstack/react-query.gen';
import WorkflowTag from '@/components/workflow/WorkflowTag';

const { RangePicker } = DatePicker;

export interface WorkflowSearchProps {
  onTagsChange: (tags: string | null) => void;
  onNameChange: (name: string | null) => void;
  onDateRangeChange: (startAt: string | null, endAt: string | null) => void;
  tags?: string | null;
  name?: string | null;
  startAt?: string | null;
  endAt?: string | null;
  className?: string;
}

const WorkflowSearch: React.FC<WorkflowSearchProps> = ({
  onTagsChange,
  onNameChange,
  onDateRangeChange,
  name,
  tags,
  className,
}) => {
  // Local state for immediate UI updates
  const [localName, setLocalName] = useState(name || '');
  const { data: allTags } = useQuery({
    ...getAllTagsOptions(),
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedName = localName.trim();
      onNameChange(trimmedName || null);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [localName, onNameChange]);

  useEffect(() => {
    setLocalName(name || '');
  }, [name]);

  const handleTagsChange = (e: string[]) => {
    onTagsChange(e.join(','));
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalName(e.target.value);
  };

  const handleDateRangeChange = (
    dates: [Dayjs | null, Dayjs | null] | null,
  ) => {
    if (dates && dates[0]) {
      // Start time is provided - use local time format to match DatePicker display
      const startTime = dates[0].format();
      // If end time is not provided, default to today (current time)
      const endTime = dates[1] ? dates[1].format() : dayjs().format();
      onDateRangeChange(startTime, endTime);
    } else {
      // Clear both when no start time is selected
      onDateRangeChange(null, null);
    }
  };

  const rangePresets: TimeRangePickerProps['presets'] = [
    { label: 'Last 1 Days', value: [dayjs().add(-1, 'd'), dayjs()] },
    { label: 'Last 2 Days', value: [dayjs().add(-2, 'd'), dayjs()] },
    { label: 'Last 7 Days', value: [dayjs().add(-7, 'd'), dayjs()] },
    { label: 'Last 30 Days', value: [dayjs().add(-30, 'd'), dayjs()] },
  ];

  return (
    <div
      className={`flex flex-wrap items-center bg-slate-100/50 border-none rounded-2xl shadow-sm divide-x divide-slate-100/50 overflow-hidden h-12 ${className || ''}`}
    >
      <div className="flex-[1.5] min-w-[200px] h-full flex items-center px-4 hover:bg-slate-50/50 transition-colors">
        <Tag size={16} className="text-slate-400 mr-3 flex-shrink-0" />
        <Select
          options={allTags?.map((tag) => ({ label: tag, value: tag }))}
          placeholder="Filter by tags"
          allowClear
          onChange={handleTagsChange}
          value={tags && tags.trim() ? tags.split(',') : []}
          tagRender={(tag) => <WorkflowTag tag={tag.label as string} />}
          mode="multiple"
          className="w-full font-sans border-none focus:ring-0"
          variant="borderless"
          popupClassName="premium-select-popup"
        />
      </div>

      <div className="flex-1 min-w-[150px] h-full flex items-center px-4 hover:bg-slate-50/50 transition-colors">
        <Search size={16} className="text-slate-400 mr-3 flex-shrink-0" />
        <Input
          placeholder="Search by name"
          allowClear
          value={localName}
          onChange={handleNameChange}
          className="w-full font-sans p-0 m-0 border-none shadow-none focus:ring-0"
          variant="borderless"
        />
      </div>

      <div className="flex-[1.5] min-w-[250px] h-full flex items-center px-4 hover:bg-slate-50/50 transition-colors">
        <Calendar size={16} className="text-slate-400 mr-3 flex-shrink-0" />
        <RangePicker
          presets={[...rangePresets]}
          placeholder={['Start At', 'End At']}
          allowEmpty={[true, true]}
          showTime
          format="YYYY-MM-DD HH:mm"
          onChange={handleDateRangeChange}
          className="w-full font-sans border-none shadow-none p-0 m-0 focus:ring-0"
          allowClear
          variant="borderless"
        />
      </div>
    </div>
  );
};

export default WorkflowSearch;
