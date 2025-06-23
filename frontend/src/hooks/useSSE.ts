import { useCallback, useEffect, useRef, useState } from "react";

import { constructApiUrl } from "../api/client";
import { getSSESettings, isSSEEnabled } from "../config/sseConfig";

// Define the possible SSE event types based on the API
export interface SSEEvent {
  id?: string;
  event?: string;
  data: unknown;
  timestamp?: string;
}

// Define specific event data structures
export interface DatabaseChangeData {
  workflow_id?: string;
  table: string;
  operation: string;
  timestamp: number;
  formatted_timestamp: string;
  channel: string;
  record_id?: string;
  old_status?: string;
  new_status?: string;
  status_changed?: boolean;
  [key: string]: unknown;
}

// Define event types that the backend sends
export type SSEEventType =
  | "database_change"
  | `jobs.${string}` // jobs.{workflow_id}
  | `workflow.${string}`; // workflow.{workflow_id}

// Define connection states
export type SSEConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

// Hook options
export interface UseSSEOptions {
  filters?: string; // Comma-separated list of table names to filter
  workflowId?: string; // Subscribe to specific workflow events
  enabled?: boolean;
  reconnectInterval?: number; // Milliseconds
  maxRetries?: number;
  onJobEvent?: (data: DatabaseChangeData) => void; // Callback for job events
  onWorkflowEvent?: (data: DatabaseChangeData) => void; // Callback for workflow events
  onDatabaseChange?: (data: DatabaseChangeData) => void; // Callback for general database changes
}

// Hook return type
export interface UseSSEReturn {
  data: SSEEvent | null;
  status: SSEConnectionStatus;
  error: string | null;
  isConnected: boolean;
  reconnect: () => void;
  disconnect: () => void;
  retryCount: number;
}

export const useSSE = ({
  filters,
  workflowId,
  reconnectInterval = 3000,
  maxRetries = 5,
  onJobEvent,
  onWorkflowEvent,
  onDatabaseChange,
}: UseSSEOptions = {}): UseSSEReturn => {
  // Check global SSE configuration first
  const globalSSEEnabled = isSSEEnabled();
  const sseSettings = getSSESettings({ reconnectInterval, maxRetries });

  const [data, setData] = useState<SSEEvent | null>(null);
  const [status, setStatus] = useState<SSEConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (!isSSEEnabled() || eventSourceRef.current) {
      return;
    }

    setStatus("connecting");
    setError(null);

    const urlString = constructApiUrl("/api/v1/sse/events");
    const url = new URL(urlString);

    if (filters) {
      url.searchParams.set("filters", filters);
    }
    if (workflowId) {
      url.searchParams.set("workflow_id", workflowId);
    }

    try {
      console.log("🔄 Attempting to connect to SSE:", url.toString());
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setStatus("connected");
        setError(null);
        setRetryCount(0);
        console.log("✅ SSE connected successfully to:", url.toString());
      };

      eventSource.onmessage = (event) => {
        try {
          const parsedData = JSON.parse(event.data);
          console.log("📦 Parsed SSE data:", parsedData);
          const sseEvent: SSEEvent = {
            id: event.lastEventId || undefined,
            data: parsedData,
            timestamp: new Date().toISOString(),
          };
          setData(sseEvent);
        } catch (parseError) {
          console.error(
            "❌ Failed to parse SSE data:",
            parseError,
            "Raw data:",
            event.data,
          );
          const sseEvent: SSEEvent = {
            id: event.lastEventId || undefined,
            data: event.data,
            timestamp: new Date().toISOString(),
          };
          setData(sseEvent);
        }
      };

      eventSource.onerror = (event) => {
        console.error("SSE error:", event);
        setStatus("error");
        setError("Connection error occurred");

        // Clean up current connection
        eventSource.close();
        eventSourceRef.current = null;

        // Attempt to reconnect if enabled and within retry limits
        setRetryCount((prev) => {
          const currentRetryCount = prev;
          if (isSSEEnabled() && currentRetryCount < sseSettings.maxRetries) {
            reconnectTimeoutRef.current = setTimeout(() => {
              // Check again when timeout executes to get fresh state
              connect(); // connect() will check isSSEEnabled() internally
            }, sseSettings.reconnectInterval);
            return currentRetryCount + 1;
          } else {
            setStatus("disconnected");
            if (currentRetryCount >= sseSettings.maxRetries) {
              setError(
                `Max retry attempts (${sseSettings.maxRetries}) exceeded`,
              );
            }
            return currentRetryCount;
          }
        });
      };

      // Handle different event types
      eventSource.addEventListener("database_change", (event) => {
        try {
          const parsedData = JSON.parse(event.data) as DatabaseChangeData;
          // console.log("📊 Database change event:", parsedData);

          const sseEvent: SSEEvent = {
            id: event.lastEventId || undefined,
            event: "database_change",
            data: parsedData,
            timestamp: new Date().toISOString(),
          };
          setData(sseEvent);

          // Call callback if provided
          if (onDatabaseChange) {
            onDatabaseChange(parsedData);
          }
        } catch (parseError) {
          console.error("❌ Failed to parse database_change data:", parseError);
        }
      });

      // Handle job events for specific workflows
      if (workflowId) {
        const jobEventType = `jobs.${workflowId}`;
        eventSource.addEventListener(jobEventType, (event) => {
          try {
            const parsedData = JSON.parse(event.data) as DatabaseChangeData;
            console.log(`💼 Job event for workflow ${workflowId}:`, parsedData);

            const sseEvent: SSEEvent = {
              id: event.lastEventId || undefined,
              event: jobEventType,
              data: parsedData,
              timestamp: new Date().toISOString(),
            };
            setData(sseEvent);

            // Call callback if provided
            if (onJobEvent) {
              onJobEvent(parsedData);
            }
          } catch (parseError) {
            console.error(
              `❌ Failed to parse ${jobEventType} data:`,
              parseError,
            );
          }
        });

        // Handle workflow events for specific workflows
        const workflowEventType = `workflow.${workflowId}`;
        eventSource.addEventListener(workflowEventType, (event) => {
          try {
            const parsedData = JSON.parse(event.data) as DatabaseChangeData;
            console.log(
              `🔄 Workflow event for workflow ${workflowId}:`,
              parsedData,
            );

            const sseEvent: SSEEvent = {
              id: event.lastEventId || undefined,
              event: workflowEventType,
              data: parsedData,
              timestamp: new Date().toISOString(),
            };
            setData(sseEvent);

            // Call callback if provided
            if (onWorkflowEvent) {
              onWorkflowEvent(parsedData);
            }
          } catch (parseError) {
            console.error(
              `❌ Failed to parse ${workflowEventType} data:`,
              parseError,
            );
          }
        });
      }
    } catch (connectionError) {
      console.error("Failed to create EventSource:", connectionError);
      setStatus("error");
      setError("Failed to establish connection");
    }
  }, [filters, workflowId, maxRetries, reconnectInterval]);

  const reconnect = useCallback(() => {
    disconnect();
    setRetryCount(0);
    // Small delay before reconnecting - connect() will check if SSE is enabled
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  // Effect to handle connection lifecycle
  useEffect(() => {
    if (globalSSEEnabled) {
      connect();
    } else {
      disconnect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [globalSSEEnabled, connect, disconnect]);

  // Effect to handle cleanup on filters/workflowId change
  useEffect(() => {
    if (globalSSEEnabled && eventSourceRef.current) {
      // Reconnect when filters or workflowId change
      reconnect();
    }
  }, [filters, workflowId, globalSSEEnabled, reconnect]);

  return {
    data,
    status,
    error,
    isConnected: status === "connected",
    reconnect,
    disconnect,
    retryCount,
  };
};

// Dedicated hook for workflow logs SSE
export const useLogSSE = (
  workflowId: string,
  options: {
    enabled?: boolean;
    reconnectInterval?: number;
    maxRetries?: number;
    onLogLine?: (logLine: string) => void;
  } = {},
) => {
  const {
    enabled = true,
    reconnectInterval = 3000,
    maxRetries = 5,
    onLogLine,
  } = options;

  // Check global SSE configuration
  const globalSSEEnabled = isSSEEnabled();
  const sseSettings = getSSESettings({ reconnectInterval, maxRetries });

  // SSE is only enabled if both global config and local enabled are true
  const shouldConnect = globalSSEEnabled && enabled;

  const [status, setStatus] = useState<SSEConnectionStatus>("disconnected");
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    setStatus("disconnected");
  }, []);

  const connect = useCallback(() => {
    if (!(isSSEEnabled() && enabled) || eventSourceRef.current || !workflowId) {
      return;
    }

    setStatus("connecting");
    setError(null);

    // Use logs-specific endpoint
    const urlString = constructApiUrl(`/api/v1/logs/${workflowId}/sse`);
    const url = new URL(urlString);

    try {
      console.log(`🔄 Attempting to connect to logs SSE: ${url.toString()}`);
      const eventSource = new EventSource(url.toString());
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setStatus("connected");
        setError(null);
        setRetryCount(0);
        console.log(
          `✅ Logs SSE connected successfully for workflow: ${workflowId}`,
        );
      };

      eventSource.onerror = (event) => {
        console.error("Logs SSE error:", event);
        setStatus("error");
        setError("Connection error occurred");

        eventSource.close();
        eventSourceRef.current = null;

        setRetryCount((prev) => {
          const currentRetryCount = prev;
          if (
            isSSEEnabled() &&
            enabled &&
            currentRetryCount < sseSettings.maxRetries
          ) {
            reconnectTimeoutRef.current = setTimeout(() => {
              // Check again when timeout executes to get fresh state
              connect(); // connect() will check conditions internally
            }, sseSettings.reconnectInterval);
            return currentRetryCount + 1;
          } else {
            setStatus("disconnected");
            if (currentRetryCount >= sseSettings.maxRetries) {
              setError(
                `Max retry attempts (${sseSettings.maxRetries}) exceeded`,
              );
            }
            return currentRetryCount;
          }
        });
      };

      // Handle log events
      const logEventType = `logs.${workflowId}`;
      eventSource.addEventListener(logEventType, (event) => {
        try {
          const logLine = event.data;
          console.log(`📝 Log line for workflow ${workflowId}:`, logLine);

          if (onLogLine) {
            onLogLine(logLine);
          }
        } catch (error) {
          console.error(`❌ Failed to handle log event:`, error);
        }
      });
    } catch (connectionError) {
      console.error("Failed to create logs EventSource:", connectionError);
      setStatus("error");
      setError("Failed to establish connection");
    }
  }, [
    workflowId,
    enabled,
    sseSettings.maxRetries,
    sseSettings.reconnectInterval,
    onLogLine,
  ]);

  const reconnect = useCallback(() => {
    disconnect();
    setRetryCount(0);
    // Small delay before reconnecting - connect() will check conditions
    setTimeout(connect, 100);
  }, [disconnect, connect]);

  useEffect(() => {
    if (shouldConnect && workflowId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [shouldConnect, workflowId, connect, disconnect]);

  return {
    status,
    error,
    isConnected: status === "connected",
    reconnect,
    disconnect,
    retryCount,
  };
};
