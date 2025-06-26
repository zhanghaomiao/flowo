import React, { useMemo, useState } from "react";
import { Card, Col, DatePicker, Empty, Row, Select, Typography } from "antd";
import dayjs from "dayjs";
import { Chart } from "react-google-charts";

import { GetActivityApiV1SummaryActivityGetItemEnum } from "../../api/api";
import {
  useActivity,
  useRuleError,
  useRuleDuration,
} from "./useDashboardMetrics";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface ActivityAnalyticsCardProps {
  title?: string;
  defaultLimit?: number;
  height?: string;
}

export const ActivityAnalyticsCard: React.FC<ActivityAnalyticsCardProps> = ({
  title = "Activity & Error Analytics",
  defaultLimit = 10,
  height = "700px",
}) => {
  const [limit, setLimit] = useState(defaultLimit);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(
    null,
  );

  // Format dates for API
  const startDate = dateRange?.[0]?.toISOString() || null;
  const endDate = dateRange?.[1]?.toISOString() || null;

  // Fetch both rule and tag data
  const {
    data: ruleData,
    isLoading: ruleLoading,
    error: ruleError,
  } = useActivity(
    GetActivityApiV1SummaryActivityGetItemEnum.Rule,
    startDate,
    endDate,
    limit,
  );

  const {
    data: tagData,
    isLoading: tagLoading,
    error: tagError,
  } = useActivity(
    GetActivityApiV1SummaryActivityGetItemEnum.Tag,
    startDate,
    endDate,
    limit,
  );

  // Fetch rule error data
  const {
    data: ruleErrorData,
    isLoading: ruleErrorLoading,
    error: ruleErrorError,
  } = useRuleError(startDate, endDate, limit);

  // Fetch rule duration data
  const {
    data: ruleDurationData,
    isLoading: ruleDurationLoading,
    error: ruleDurationError,
  } = useRuleDuration(startDate, endDate, limit);

  // Process data for charts
  const ruleChartData = useMemo(() => {
    if (!ruleData) return [];
    return Object.entries(ruleData).map(([name, count]) => ({ name, count }));
  }, [ruleData]);

  const tagChartData = useMemo(() => {
    if (!tagData) return [];
    return Object.entries(tagData).map(([name, count]) => ({ name, count }));
  }, [tagData]);

  // Process rule error data for stacked bar chart
  const ruleErrorChartData = useMemo(() => {
    if (!ruleErrorData) return [];
    return Object.entries(ruleErrorData).map(([name, stats]) => ({
      name,
      total: stats.total,
      error: stats.error,
      success: stats.total - stats.error,
    }));
  }, [ruleErrorData]);

  // Process rule duration data for box plot
  const ruleDurationChartData = useMemo(() => {
    if (!ruleDurationData) return [];
    return Object.entries(ruleDurationData).map(([name, durations]) => ({
      name,
      durations,
    }));
  }, [ruleDurationData]);

  const isLoading =
    ruleLoading || tagLoading || ruleErrorLoading || ruleDurationLoading;
  const hasError = ruleError || tagError || ruleErrorError || ruleDurationError;

  // Bar Chart Component using Google Charts
  const BarChart = ({
    data,
    color,
    title,
  }: {
    data: Array<{ name: string; count: number }>;
    color: string;
    title: string;
  }) => {
    if (data.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${title.toLowerCase()} data found`}
          style={{ margin: "20px 0" }}
        />
      );
    }

    // Prepare data for Google Charts
    const chartData = [
      ["Name", "Count"],
      ...data.map((item) => [item.name, item.count]),
    ];

    const options = {
      title: "",
      titleTextStyle: {
        fontSize: 14,
        bold: true,
        color: "#333",
      },
      chartArea: {
        left: 80,
        top: 20,
        width: "70%",
        height: "85%",
      },
      hAxis: {
        title: "Count",
        titleTextStyle: {
          fontSize: 10,
          color: "#666",
        },
        textStyle: {
          fontSize: 9,
          color: "#666",
        },
        gridlines: {
          color: "#f0f0f0",
          count: 4,
        },
      },
      vAxis: {
        title: "",
        textStyle: {
          fontSize: 11,
          color: "#333",
        },
      },
      colors: [color],
      backgroundColor: "transparent",
      legend: { position: "none" },
      bar: { groupWidth: "70%" },
      tooltip: {
        textStyle: {
          fontSize: 11,
        },
        showColorCode: false,
      },
    };

    return (
      <div>
        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={5} style={{ margin: 0, color: "#333" }}>
            {title}
          </Title>
        </div>

        <div style={{ height: "350px", width: "100%" }}>
          <Chart
            chartType="BarChart"
            width="100%"
            height="100%"
            data={chartData}
            options={options}
          />
        </div>
      </div>
    );
  };

  // Stacked Bar Chart Component for Rule Errors
  const StackedBarChart = ({
    data,
    title,
  }: {
    data: Array<{
      name: string;
      total: number;
      error: number;
      success: number;
    }>;
    title: string;
  }) => {
    if (data.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${title.toLowerCase()} data found`}
          style={{ margin: "20px 0" }}
        />
      );
    }

    // Prepare data for Google Charts stacked bar chart
    const chartData = [
      ["Rule", "Success", "Error"],
      ...data.map((item) => [item.name, item.success, item.error]),
    ];

    const options = {
      title: "",
      titleTextStyle: {
        fontSize: 14,
        bold: true,
        color: "#333",
      },
      chartArea: {
        left: 80,
        top: 35,
        width: "70%",
        height: "75%",
      },
      hAxis: {
        title: "Count",
        titleTextStyle: {
          fontSize: 10,
          color: "#666",
        },
        textStyle: {
          fontSize: 9,
          color: "#666",
        },
        gridlines: {
          color: "#f0f0f0",
          count: 4,
        },
      },
      vAxis: {
        title: "",
        textStyle: {
          fontSize: 11,
          color: "#333",
        },
      },
      colors: ["#37a460", "#ff4d4f"], // Green for success, red for error
      backgroundColor: "transparent",
      legend: {
        position: "top",
        alignment: "center",
        textStyle: {
          fontSize: 10,
          color: "#666",
        },
      },
      bar: { groupWidth: "70%" },
      isStacked: true,
      tooltip: {
        textStyle: {
          fontSize: 11,
        },
        showColorCode: false,
      },
    };

    return (
      <div>
        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={5} style={{ margin: 0, color: "#333" }}>
            {title}
          </Title>
        </div>

        <div style={{ height: "350px", width: "100%" }}>
          <Chart
            chartType="BarChart"
            width="100%"
            height="100%"
            data={chartData}
            options={options}
          />
        </div>
      </div>
    );
  };

  // Box Plot Component for Rule Duration (using Column Chart with error bars simulation)
  const BoxPlot = ({
    data,
    title,
  }: {
    data: Array<{ name: string; durations: number[] }>;
    title: string;
  }) => {
    if (data.length === 0) {
      return (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={`No ${title.toLowerCase()} data found`}
          style={{ margin: "20px 0" }}
        />
      );
    }

    // Calculate average duration for each rule
    const calculateAverage = (durations: number[]) => {
      if (durations.length === 0) return 0;
      return durations.reduce((sum, val) => sum + val, 0) / durations.length;
    };

    // Prepare data for Bar Chart showing only average values
    const chartData = [
      ["Rule", "Average Duration"],
      ...data.map((item) => [item.name, calculateAverage(item.durations)]),
    ];

    const options = {
      title: "",
      titleTextStyle: {
        fontSize: 14,
        bold: true,
        color: "#333",
      },
      chartArea: {
        left: 80,
        top: 20,
        width: "70%",
        height: "85%",
      },
      hAxis: {
        title: "Duration (s)",
        titleTextStyle: {
          fontSize: 10,
          color: "#666",
        },
        textStyle: {
          fontSize: 9,
          color: "#333",
        },
        gridlines: {
          color: "#f0f0f0",
          count: 4,
        },
        format: "0.#",
      },
      vAxis: {
        title: "",
        textStyle: {
          fontSize: 11,
          color: "#333",
        },
      },
      colors: ["#722ed1"],
      backgroundColor: "transparent",
      legend: { position: "none" },
      bar: { groupWidth: "70%" },
      tooltip: {
        textStyle: {
          fontSize: 11,
        },
        showColorCode: false,
      },
    };

    return (
      <div>
        <div
          style={{
            marginBottom: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Title level={5} style={{ margin: 0, color: "#333" }}>
            {title}
          </Title>
        </div>

        <div style={{ height: "350px", width: "100%" }}>
          <Chart
            chartType="BarChart"
            width="100%"
            height="100%"
            data={chartData}
            options={options}
          />
        </div>
      </div>
    );
  };

  return (
    <Card
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Title level={4} style={{ margin: 0 }}>
            {title}
          </Title>
          {(ruleChartData.length > 0 ||
            tagChartData.length > 0 ||
            ruleErrorChartData.length > 0 ||
            ruleDurationChartData.length > 0) && (
            <Text type="secondary" style={{ fontSize: "11px" }}>
              Rules: {ruleChartData.length} | Tags: {tagChartData.length} |
              Errors: {ruleErrorChartData.length} | Duration:{" "}
              {ruleDurationChartData.length}
            </Text>
          )}
        </div>
      }
      loading={isLoading}
      style={{ height }}
    >
      {/* Controls */}
      <Row gutter={[16, 16]} style={{ marginBottom: "24px" }}>
        <Col xs={24} sm={12}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Text strong style={{ fontSize: "12px" }}>
              Limit
            </Text>
            <Select
              value={limit}
              onChange={setLimit}
              style={{ width: "100%" }}
              options={[
                { value: 5, label: "Top 5" },
                { value: 10, label: "Top 10" },
                { value: 15, label: "Top 15" },
                { value: 20, label: "Top 20" },
                { value: 30, label: "Top 30" },
              ]}
            />
          </div>
        </Col>

        <Col xs={24} sm={12}>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <Text strong style={{ fontSize: "12px" }}>
              Time Range
            </Text>
            <RangePicker
              value={dateRange}
              onChange={(dates) =>
                setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)
              }
              style={{ width: "100%" }}
              placeholder={["Start Date", "End Date"]}
              allowClear
              presets={[
                {
                  label: "Last 7 Days",
                  value: [dayjs().subtract(7, "day"), dayjs()],
                },
                {
                  label: "Last 30 Days",
                  value: [dayjs().subtract(30, "day"), dayjs()],
                },
                {
                  label: "Last 3 Months",
                  value: [dayjs().subtract(3, "month"), dayjs()],
                },
              ]}
            />
          </div>
        </Col>
      </Row>

      {/* Error State */}
      {hasError && (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <Text type="danger">Error loading activity data</Text>
        </div>
      )}

      {/* Charts */}
      {!hasError && (
        <Row gutter={[8, 0]}>
          <Col xs={24} xxl={6} xl={12} lg={24}>
            <div style={{ maxHeight: "450px", overflow: "hidden" }}>
              <BarChart data={ruleChartData} color="#37a460" title="Rules" />
            </div>
          </Col>

          <Col xs={24} xxl={6} xl={12} lg={24}>
            <div style={{ maxHeight: "450px", overflow: "hidden" }}>
              <BarChart data={tagChartData} color="#37a460" title="Tags" />
            </div>
          </Col>

          <Col xs={24} xxl={6} xl={12} lg={24}>
            <div style={{ maxHeight: "450px", overflow: "hidden" }}>
              <StackedBarChart
                data={ruleErrorChartData}
                title="Rule Error Analysis"
              />
            </div>
          </Col>

          <Col xs={24} xxl={6} xl={12} lg={24}>
            <div style={{ maxHeight: "450px", overflow: "hidden" }}>
              <BoxPlot data={ruleDurationChartData} title="Rule Duration" />
            </div>
          </Col>
        </Row>
      )}

      {/* Time Range Info */}
      {!isLoading && (
        <div style={{ marginTop: "16px", textAlign: "center" }}>
          <Text type="secondary" style={{ fontSize: "11px" }}>
            {dateRange
              ? `Data from ${dateRange[0].format("MMM DD, YYYY")} to ${dateRange[1].format("MMM DD, YYYY")}`
              : "Showing all-time data"}
          </Text>
        </div>
      )}
    </Card>
  );
};
