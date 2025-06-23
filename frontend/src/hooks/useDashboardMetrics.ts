import { useMemo } from "react";

import type { WorkflowResponse } from "../api/client";
import { useWorkflowsWithSSE } from "./useQueriesWithSSE";

export interface DashboardMetrics {
  totalWorkflows: number;
  activeWorkflows: number;
  failedWorkflows: number;
  completedWorkflows: number;
  successRate: number;
  avgExecutionTime: number;
  activeUsers: number;
  totalJobs: number;
  statusDistribution: {
    SUCCESS: number;
    RUNNING: number;
    ERROR: number;
    WAITING: number;
  };
  performanceTrends: Array<{
    date: string;
    completed: number;
    failed: number;
    avgDuration: number;
  }>;
  userActivity: Array<{
    user: string;
    totalWorkflows: number;
    successCount: number;
    failureCount: number;
    successRate: number;
  }>;
  systemHealth: {
    uptime: string;
    avgResponseTime: number;
    errorRate: number;
    status: "healthy" | "warning" | "critical";
  };
}

const calculateDuration = (
  startTime: string | null,
  endTime: string | null,
): number => {
  if (!startTime || !endTime) return 0;
  const start = new Date(startTime).getTime();
  const end = new Date(endTime).getTime();
  return Math.round((end - start) / 1000 / 60); // minutes
};

const calculateStatusDistribution = (workflows: WorkflowResponse[]) => {
  const distribution = {
    SUCCESS: 0,
    RUNNING: 0,
    ERROR: 0,
    WAITING: 0,
  };

  workflows.forEach((workflow) => {
    const status = workflow.status.toUpperCase() as keyof typeof distribution;
    if (status in distribution) {
      distribution[status]++;
    }
  });

  return distribution;
};

const calculatePerformanceTrends = (workflows: WorkflowResponse[]) => {
  const trendsMap = new Map<
    string,
    { completed: number; failed: number; durations: number[] }
  >();

  workflows.forEach((workflow) => {
    if (!workflow.started_at) return;

    const date = new Date(workflow.started_at).toISOString().split("T")[0];
    const existing = trendsMap.get(date) || {
      completed: 0,
      failed: 0,
      durations: [],
    };

    if (workflow.status === "SUCCESS") {
      existing.completed++;
      if (workflow.end_time) {
        const duration = calculateDuration(
          workflow.started_at,
          workflow.end_time,
        );
        if (duration > 0) existing.durations.push(duration);
      }
    } else if (workflow.status === "ERROR") {
      existing.failed++;
    }

    trendsMap.set(date, existing);
  });

  return Array.from(trendsMap.entries())
    .map(([date, data]) => ({
      date,
      completed: data.completed,
      failed: data.failed,
      avgDuration:
        data.durations.length > 0
          ? Math.round(
              data.durations.reduce((a, b) => a + b, 0) / data.durations.length,
            )
          : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-7); // Last 7 days
};

const calculateUserActivity = (workflows: WorkflowResponse[]) => {
  const userMap = new Map<
    string,
    { total: number; success: number; failure: number }
  >();

  workflows.forEach((workflow) => {
    const user = workflow.user || "Unknown";
    const existing = userMap.get(user) || { total: 0, success: 0, failure: 0 };

    existing.total++;
    if (workflow.status === "SUCCESS") {
      existing.success++;
    } else if (workflow.status === "ERROR") {
      existing.failure++;
    }

    userMap.set(user, existing);
  });

  return Array.from(userMap.entries())
    .map(([user, data]) => ({
      user,
      totalWorkflows: data.total,
      successCount: data.success,
      failureCount: data.failure,
      successRate:
        data.total > 0 ? Math.round((data.success / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.totalWorkflows - a.totalWorkflows);
};

export const useDashboardMetrics = () => {
  // Use SSE-enabled workflows for real-time updates
  const {
    data: workflowsData,
    isLoading,
    error,
    refetch,
    sseError,
    isSSEConnected,
    sseRetryCount,
    reconnectSSE,
  } = useWorkflowsWithSSE({
    limit: 1000, // Get more data for comprehensive metrics
    offset: 0,
    orderByStarted: true,
    descending: true,
  });

  const metrics = useMemo<DashboardMetrics | null>(() => {
    if (!workflowsData?.workflows) return null;

    const workflows = workflowsData.workflows;

    // Calculate basic metrics
    const totalWorkflows = workflows.length;
    const activeWorkflows = workflows.filter(
      (w) => w.status === "RUNNING" || w.status === "WAITING",
    ).length;
    const completedWorkflows = workflows.filter(
      (w) => w.status === "SUCCESS",
    ).length;
    const failedWorkflows = workflows.filter(
      (w) => w.status === "ERROR",
    ).length;

    const successRate =
      totalWorkflows > 0
        ? Math.round((completedWorkflows / totalWorkflows) * 100)
        : 0;

    // Calculate average execution time
    const completedWithDuration = workflows.filter(
      (w) => w.status === "SUCCESS" && w.started_at && w.end_time,
    );

    const avgExecutionTime =
      completedWithDuration.length > 0
        ? Math.round(
            completedWithDuration.reduce(
              (sum, w) =>
                sum +
                calculateDuration(
                  w.started_at,
                  w.end_time || new Date().toISOString(),
                ),
              0,
            ) / completedWithDuration.length,
          )
        : 0;

    // Calculate active users (users with workflows in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentUsers = new Set(
      workflows
        .filter((w) => w.started_at && new Date(w.started_at) >= sevenDaysAgo)
        .map((w) => w.user)
        .filter(Boolean),
    );

    const totalJobs = Math.round(totalWorkflows * 10);

    const errorRate =
      totalWorkflows > 0
        ? Math.round((failedWorkflows / totalWorkflows) * 100)
        : 0;

    const systemHealth = {
      uptime: "99.9%", // This would come from system monitoring
      avgResponseTime: 150, // This would come from API monitoring
      errorRate,
      status: (errorRate > 20
        ? "critical"
        : errorRate > 10
          ? "warning"
          : "healthy") as const,
    };

    return {
      totalWorkflows,
      activeWorkflows,
      failedWorkflows,
      completedWorkflows,
      successRate,
      avgExecutionTime,
      activeUsers: recentUsers.size,
      totalJobs,
      statusDistribution: calculateStatusDistribution(workflows),
      performanceTrends: calculatePerformanceTrends(workflows),
      userActivity: calculateUserActivity(workflows),
      systemHealth,
    };
  }, [workflowsData]);

  return {
    metrics,
    isLoading,
    error: error || sseError,
    refetch,
    isSSEConnected,
    sseRetryCount,
    reconnectSSE,
  };
};
