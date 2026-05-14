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
  startAt,
  endAt,
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
      const startTime = dates[0].toDate().toISOString();
      const endTime = dates[1]
        ? dates[1].toDate().toISOString()
        : dayjs().toDate().toISOString();
      onDateRangeChange(startTime, endTime);
    } else {
      onDateRangeChange(null, null);
    }
  };

  const rangePickerValue: [Dayjs, Dayjs] | null = (() => {
    if (!startAt || !endAt) {
      return null;
    }
    const a = dayjs(startAt);
    const b = dayjs(endAt);
    if (!a.isValid() || !b.isValid()) {
      return null;
    }
    return [a, b];
  })();

  const rangePresets: TimeRangePickerProps['presets'] = [
    { label: 'Last 1 Days', value: [dayjs().add(-1, 'd'), dayjs()] },
    { label: 'Last 2 Days', value: [dayjs().add(-2, 'd'), dayjs()] },
    { label: 'Last 7 Days', value: [dayjs().add(-7, 'd'), dayjs()] },
    { label: 'Last 30 Days', value: [dayjs().add(-30, 'd'), dayjs()] },
  ];

  return (
    <div
      className={`flex h-12 max-w-7xl flex-wrap items-center overflow-hidden rounded-2xl border border-slate-300 bg-slate-100/50 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${className || ''}`}
    >
      <div className="flex h-full min-w-0 shrink flex-1 items-center px-3 transition-colors hover:bg-slate-50/50 sm:min-w-[170px] sm:max-w-[270px]">
        <Tag size={16} className="mr-2 shrink-0 text-slate-400" />
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

      <div className="flex h-full min-w-0 shrink flex-1 items-center px-3 transition-colors hover:bg-slate-50/50 sm:min-w-[190px] sm:max-w-[min(100%,28rem)]">
        <Search size={16} className="mr-2 shrink-0 text-slate-400" />
        <Input
          placeholder="Search runs by name"
          allowClear
          value={localName}
          onChange={handleNameChange}
          className="w-full font-sans p-0 m-0 border-none shadow-none focus:ring-0"
          variant="borderless"
        />
      </div>

      <div className="flex h-full min-w-[min(100%,20rem)] shrink-0 items-center px-3 transition-colors hover:bg-slate-50/50 sm:min-w-[32.5rem]">
        <Calendar size={16} className="mr-2 shrink-0 text-slate-400" />
        <RangePicker
          presets={[...rangePresets]}
          placeholder={['From', 'To']}
          allowEmpty={[true, true]}
          showTime
          format="YYYY-MM-DD HH:mm"
          value={rangePickerValue}
          onChange={handleDateRangeChange}
          className="m-0 w-full flex-1 border-none p-0 font-sans shadow-none focus:ring-0 [&_.ant-picker-input>input]:min-w-[9.5rem] sm:[&_.ant-picker-input>input]:min-w-[10.75rem]"
          allowClear
          variant="borderless"
        />
      </div>
    </div>
  );
};

export default WorkflowSearch;
