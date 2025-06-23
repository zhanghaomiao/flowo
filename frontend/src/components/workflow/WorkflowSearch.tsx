import { SearchOutlined } from "@ant-design/icons";
import type { TimeRangePickerProps } from "antd";
import { DatePicker, Input, Select, Space } from "antd";
import dayjs, { Dayjs } from "dayjs";
import React, { useEffect, useState } from "react";

import { useAllTags } from "../../hooks/useQueries";
import WorkflowTag from "../tag/WorkflowTag";

const { RangePicker } = DatePicker;

interface WorkflowSearchProps {
  onTagsChange: (tags: string | null) => void;
  onNameChange: (name: string | null) => void;
  onDateRangeChange: (startAt: string | null, endAt: string | null) => void;
  tags?: string | null;
  name?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}

const WorkflowSearch: React.FC<WorkflowSearchProps> = ({
  onTagsChange,
  onNameChange,
  onDateRangeChange,
  name,
  tags,
}) => {
  // Local state for immediate UI updates
  const [localName, setLocalName] = useState(name || "");
  const { data: allTags } = useAllTags();

  // Debounce the search calls

  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmedName = localName.trim();
      onNameChange(trimmedName || null);
    }, 500); // 500ms delay

    return () => clearTimeout(timer);
  }, [localName, onNameChange]);

  useEffect(() => {
    setLocalName(name || "");
  }, [name]);

  const handleTagsChange = (e: string[]) => {
    onTagsChange(e.join(","));
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

  const rangePresets: TimeRangePickerProps["presets"] = [
    { label: "Last 1 Days", value: [dayjs().add(-1, "d"), dayjs()] },
    { label: "Last 2 Days", value: [dayjs().add(-2, "d"), dayjs()] },
    { label: "Last 7 Days", value: [dayjs().add(-7, "d"), dayjs()] },
    { label: "Last 30 Days", value: [dayjs().add(-30, "d"), dayjs()] },
  ];

  return (
    <Space size="middle" style={{ display: "flex", alignItems: "center" }}>
      <Select
        options={allTags?.map((tag) => ({ label: tag, value: tag }))}
        placeholder="Search by tags"
        allowClear
        onChange={handleTagsChange}
        value={tags && tags.trim() ? tags.split(",") : []}
        tagRender={(tag) => <WorkflowTag tag={tag.label as string} />}
        mode="multiple"
        style={{ width: 130 }}
        size="small"
      />

      <Input
        placeholder="Search by name"
        prefix={<SearchOutlined />}
        allowClear
        value={localName}
        onChange={handleNameChange}
        style={{ width: 160 }}
        size="small"
      />

      <RangePicker
        presets={[
          {
            label: (
              <span aria-label="Current Time to End of Day">Now ~ END</span>
            ),
            value: () => [dayjs(), dayjs().endOf("day")], // 5.8.0+ support function
          },
          ...rangePresets,
        ]}
        placeholder={["Start time", "End time"]}
        allowEmpty={[true, true]}
        showTime
        format="YYYY-MM-DD HH:mm"
        onChange={handleDateRangeChange}
        style={{ width: 310 }}
        size="small"
        allowClear
      />
    </Space>
  );
};

export default WorkflowSearch;
