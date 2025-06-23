import { Card, Table, Tag, Empty, Progress } from "antd";
import type { ColumnsType } from "antd/es/table";
import React from "react";

interface UserActivity {
  user: string;
  totalWorkflows: number;
  successCount: number;
  failureCount: number;
  successRate: number;
}

interface UserActivityTableProps {
  data?: UserActivity[];
  loading?: boolean;
}

export const UserActivityTable: React.FC<UserActivityTableProps> = ({
  data,
  loading,
}) => {
  const columns: ColumnsType<UserActivity> = [
    {
      title: "User",
      dataIndex: "user",
      key: "user",
      render: (user: string) => (
        <span style={{ fontWeight: "500" }}>{user}</span>
      ),
    },
    {
      title: "Workflows",
      dataIndex: "totalWorkflows",
      key: "totalWorkflows",
      align: "center",
      sorter: (a, b) => a.totalWorkflows - b.totalWorkflows,
      render: (count: number) => (
        <Tag color="blue" style={{ minWidth: "40px", textAlign: "center" }}>
          {count}
        </Tag>
      ),
    },
    {
      title: "Success Rate",
      dataIndex: "successRate",
      key: "successRate",
      align: "center",
      sorter: (a, b) => a.successRate - b.successRate,
      render: (rate: number, record: UserActivity) => (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Progress
            type="circle"
            size={32}
            percent={rate}
            format={() => `${rate}%`}
            strokeColor={
              rate >= 80 ? "#52c41a" : rate >= 60 ? "#faad14" : "#ff4d4f"
            }
            trailColor="#f0f0f0"
          />
          <div style={{ fontSize: "11px", color: "#666" }}>
            <div>{record.successCount}✓</div>
            <div>{record.failureCount}✗</div>
          </div>
        </div>
      ),
    },
  ];

  if (!data || data.length === 0) {
    return (
      <Card title="User Activity" style={{ height: "300px" }}>
        <Empty
          description={loading ? "Loading..." : "No user activity data"}
          style={{ marginTop: "60px" }}
        />
      </Card>
    );
  }

  return (
    <Card title="User Activity" style={{ height: "300px" }}>
      <div style={{ height: "220px", overflow: "auto" }}>
        <Table
          columns={columns}
          dataSource={data.slice(0, 5)} // Show top 5 users
          rowKey="user"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ y: 180 }}
          showSorterTooltip={false}
        />
      </div>
      {data.length > 5 && (
        <div
          style={{
            textAlign: "center",
            marginTop: "8px",
            fontSize: "12px",
            color: "#666",
          }}
        >
          Showing top 5 of {data.length} users
        </div>
      )}
    </Card>
  );
};
