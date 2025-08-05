import { Alert, Card, Spin } from "antd";
import React, { useMemo } from "react";
import { useEffect, useRef } from "react";
import { Chart } from "react-google-charts";

import type { JobResponse } from "../../api/api";
import { useWorkflowTimeline } from "../../hooks/useQueries";

interface ChartWrapper {
  draw: () => void;
  getChart: () => {
    getSelection: () => Array<{ row: number | null; column: number | null }>;
  };
}

// Default Google Charts Gantt palette
const DEFAULT_GANTT_PALETTE = [
  {
    color: "#5e97f6",
    dark: "#2a56c6",
    light: "#c6dafc",
  },
  {
    color: "#db4437",
    dark: "#a52714",
    light: "#f4c7c3",
  },
  {
    color: "#f2a600",
    dark: "#ee8100",
    light: "#fce8b2",
  },
  {
    color: "#0f9d58",
    dark: "#0b8043",
    light: "#b7e1cd",
  },
  {
    color: "#ab47bc",
    dark: "#6a1b9a",
    light: "#e1bee7",
  },
  {
    color: "#00acc1",
    dark: "#00838f",
    light: "#b2ebf2",
  },
  {
    color: "#ff7043",
    dark: "#e64a19",
    light: "#ffccbc",
  },
  {
    color: "#9e9d24",
    dark: "#827717",
    light: "#f0f4c3",
  },
  {
    color: "#5c6bc0",
    dark: "#3949ab",
    light: "#c5cae9",
  },
  {
    color: "#f06292",
    dark: "#e91e63",
    light: "#f8bbd0",
  },
  {
    color: "#00796b",
    dark: "#004d40",
    light: "#b2dfdb",
  },
  {
    color: "#c2185b",
    dark: "#880e4f",
    light: "#f48fb1",
  },
];

// Generate consistent palette index mapping for rule names
const generatePaletteMapping = (ruleNames: string[]) => {
  const paletteMap: { [key: string]: number } = {};
  ruleNames.forEach((ruleName, index) => {
    paletteMap[ruleName] = index % DEFAULT_GANTT_PALETTE.length;
  });
  return paletteMap;
};

interface WorkflowTimelineProps {
  workflowId: string;
  selectedRule?: string | null;
  onJobSelect?: (
    jobInfo: {
      jobId: string;
      ruleName: string;
      startTime: string;
      endTime: string;
      status: string;
    } | null,
  ) => void;
}

const WorkflowTimeline: React.FC<WorkflowTimelineProps> = ({
  workflowId,
  selectedRule,
  onJobSelect,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<{ chartWrapper: ChartWrapper } | null>(null);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(() => {
      if (chartRef.current) {
        chartRef.current.chartWrapper.draw();
      }
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const {
    data: timelineData,
    isLoading,
    error,
  } = useWorkflowTimeline(workflowId);

  // Create consistent palette index mapping based on all available rules
  const paletteMapping = useMemo(() => {
    if (!timelineData) return {};

    const allRuleNames = Object.keys(timelineData).sort(); // Sort for consistency
    return generatePaletteMapping(allRuleNames);
  }, [timelineData]);

  const ganttData = useMemo((): Array<Array<string | Date | number | null>> => {
    if (!timelineData) {
      return [
        [
          "Task ID",
          "Task Name",
          "Resource",
          "Start Date",
          "End Date",
          "Duration",
          "Percent Complete",
          "Dependencies",
        ],
      ];
    }

    // ignore the type error, it's a workaround to make the chart work
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: Array<Array<any>> = [
      [
        { type: "string", label: "Task ID" },
        { type: "string", label: "Task Name" },
        { type: "string", label: "Resource" },
        { type: "date", label: "Start Date" },
        { type: "date", label: "End Date" },
        { type: "number", label: "Duration" },
        { type: "number", label: "Percent Complete" },
        { type: "string", label: "Dependencies" },
      ],
    ];

    // Process each rule and its jobs
    Object.entries(timelineData).forEach(([ruleName, jobDatas]) => {
      if (!Array.isArray(jobDatas) || jobDatas.length === 0) {
        return;
      }
      if (selectedRule && ruleName !== selectedRule) {
        return;
      }

      // Add individual job tasks
      jobDatas.forEach((jobData: JobResponse, jobIndex: number) => {
        const [jobId, startTime, endTime, status] = jobData as [
          string,
          Date,
          Date,
          string,
        ];

        let progress = 0;
        if (status.toLowerCase() === "success") progress = 100;
        else if (status.toLowerCase() === "running") progress = 50;
        else if (status.toLowerCase() === "failed") progress = 0;

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        data.push([
          `${ruleName}_${jobIndex}`,
          jobId,
          ruleName,
          startDate,
          endDate,
          null,
          progress,
          null,
        ]);
      });
    });

    return data;
  }, [timelineData, selectedRule]);

  // Handle chart selection
  const handleChartSelect = () => {
    if (!chartRef.current) return;

    try {
      const chart = chartRef.current.chartWrapper.getChart();
      const selection = chart.getSelection();

      if (selection.length > 0) {
        const selectedItem = selection[0];
        const rowIndex = selectedItem.row;

        // Get the selected row data (add 1 to skip header row)
        if (
          rowIndex !== null &&
          rowIndex >= 0 &&
          rowIndex + 1 < ganttData.length
        ) {
          const selectedRowData = ganttData[rowIndex + 1];
          const [, jobId, ruleName, startDate, endDate, , progress] =
            selectedRowData;

          // Convert dates back to strings
          const startTime =
            startDate instanceof Date
              ? startDate.toISOString()
              : String(startDate);
          const endTime =
            endDate instanceof Date ? endDate.toISOString() : String(endDate);

          // Determine status from progress
          let status = "unknown";
          if (progress === 100) status = "success";
          else if (progress === 50) status = "running";
          else if (progress === 0) status = "failed";

          if (onJobSelect) {
            onJobSelect({
              jobId: String(jobId),
              ruleName: String(ruleName),
              startTime: startTime,
              endTime: endTime,
              status: status,
            });
          }
        }
      } else {
        // No selection
        if (onJobSelect) {
          onJobSelect(null);
        }
      }
    } catch (error) {
      console.error("Error handling chart selection:", error);
    }
  };

  // Google Charts options
  const ganttOptions = useMemo(() => {
    const taskCount = ganttData.length - 1;
    const taskHeight = 30;
    const calculatedHeight = Math.max(200, taskCount * taskHeight) + 40;

    const resourcesInCurrentData = new Set<string>();
    for (let i = 1; i < ganttData.length; i++) {
      const resource = ganttData[i][2]; // Resource is at index 2
      if (resource !== null) {
        resourcesInCurrentData.add(String(resource));
      }
    }

    const customPalette = Array.from(resourcesInCurrentData).map((resource) => {
      const paletteIndex = paletteMapping[resource] || 0;
      return DEFAULT_GANTT_PALETTE[paletteIndex];
    });

    return {
      height: calculatedHeight,
      gantt: {
        trackHeight: 30,
        criticalPathEnabled: false,
        percentEnabled: true,
        shadowEnabled: true,
        labelStyle: {
          fontName: "Arial",
          fontSize: 12,
        },
        barCornerRadius: 4,
        sortTasks: false,
        palette:
          customPalette.length > 0 ? customPalette : DEFAULT_GANTT_PALETTE,
      },
    };
  }, [ganttData, paletteMapping]);

  if (isLoading) {
    return (
      <Card style={{ height: "100%" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "200px",
          }}
        >
          <Spin size="large" />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card style={{ height: "100%" }}>
        <Alert
          message="Error Loading Timeline"
          description={error instanceof Error ? error.message : "Unknown error"}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  if (!ganttData || ganttData.length <= 1) {
    return (
      <Card style={{ height: "100%" }}>
        <div style={{ textAlign: "center", padding: "50px" }}>
          No timeline data available
        </div>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ height: "100%", width: "100%", overflow: "auto" }}
    >
      <Chart
        chartType="Gantt"
        width="100%"
        data={ganttData}
        options={ganttOptions}
        getChartWrapper={(chartWrapper) => {
          chartRef.current = { chartWrapper: chartWrapper as ChartWrapper };
        }}
        chartEvents={[
          {
            eventName: "select",
            callback: handleChartSelect,
          },
        ]}
      />
    </div>
  );
};

export default WorkflowTimeline;
