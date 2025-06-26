import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import React from "react";

import { constructApiUrl } from "../api/client";
import { isSSEEnabled } from "../config/sseConfig";
import type { DatabaseChangeData, SSEConnectionStatus } from "./useSSE";

// SSE Manager Context to share connections across components
interface SSEConnection {
  eventSource: EventSource;
  subscribers: Set<string>;
  filters: Set<string>;
  workflowId?: string;
}

interface SSEManagerContextType {
  subscribe: (
    key: string,
    options: {
      filters?: string;
      workflowId?: string;
      onEvent?: (data: DatabaseChangeData) => void;
    },
  ) => void;
  unsubscribe: (key: string) => void;
  getConnectionStatus: (key: string) => SSEConnectionStatus;
}

const SSEManagerContext = React.createContext<SSEManagerContextType | null>(
  null,
);

// SSE Manager Provider Component
export const SSEManagerProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const connectionsRef = useRef<Map<string, SSEConnection>>(new Map());
  const statusRef = useRef<Map<string, SSEConnectionStatus>>(new Map());
  const callbacksRef = useRef<Map<string, (data: DatabaseChangeData) => void>>(
    new Map(),
  );

  const createConnectionKey = (filters?: string, workflowId?: string) => {
    return `${filters || ""}:${workflowId || ""}`;
  };

  const subscribe = useCallback(
    (
      subscriberKey: string,
      options: {
        filters?: string;
        workflowId?: string;
        onEvent?: (data: DatabaseChangeData) => void;
      },
    ) => {
      if (!isSSEEnabled()) return;

      const { filters, workflowId, onEvent } = options;
      const connectionKey = createConnectionKey(filters, workflowId);

      // Store callback for this subscriber
      if (onEvent) {
        callbacksRef.current.set(subscriberKey, onEvent);
      }

      let connection = connectionsRef.current.get(connectionKey);

      if (!connection) {
        // Create new connection
        const urlString = constructApiUrl("/api/v1/sse/events");
        const url = new URL(urlString);

        if (filters) {
          url.searchParams.set("filters", filters);
        }
        if (workflowId) {
          url.searchParams.set("workflow_id", workflowId);
        }

        console.log(
          "🔄 [SSE Manager] Creating new SSE connection:",
          url.toString(),
        );
        const eventSource = new EventSource(url.toString());

        connection = {
          eventSource,
          subscribers: new Set([subscriberKey]),
          filters: new Set(filters?.split(",") || []),
          workflowId,
        };

        connectionsRef.current.set(connectionKey, connection);
        statusRef.current.set(connectionKey, "connecting");

        // Set up event handlers
        eventSource.onopen = () => {
          statusRef.current.set(connectionKey, "connected");
          console.log(
            "✅ [SSE Manager] Connected successfully to:",
            url.toString(),
          );
        };

        eventSource.onerror = () => {
          statusRef.current.set(connectionKey, "error");
          console.error("❌ [SSE Manager] Connection error:", url.toString());

          // Clean up on error
          eventSource.close();
          connectionsRef.current.delete(connectionKey);
          statusRef.current.delete(connectionKey);
        };

        // Handle database change events
        eventSource.addEventListener("database_change", (event) => {
          try {
            const parsedData = JSON.parse(event.data) as DatabaseChangeData;

            // Notify all subscribers to this connection
            connection!.subscribers.forEach((subKey) => {
              const callback = callbacksRef.current.get(subKey);
              if (callback) {
                callback(parsedData);
              }
            });
          } catch (parseError) {
            console.error(
              "❌ [SSE Manager] Failed to parse database_change data:",
              parseError,
            );
          }
        });

        // Handle job events for specific workflows
        if (workflowId) {
          const jobEventType = `jobs.${workflowId}`;
          eventSource.addEventListener(jobEventType, (event) => {
            try {
              const parsedData = JSON.parse(event.data) as DatabaseChangeData;

              connection!.subscribers.forEach((subKey) => {
                const callback = callbacksRef.current.get(subKey);
                if (callback) {
                  callback(parsedData);
                }
              });
            } catch (parseError) {
              console.error(
                `❌ [SSE Manager] Failed to parse ${jobEventType} data:`,
                parseError,
              );
            }
          });

          const workflowEventType = `workflow.${workflowId}`;
          eventSource.addEventListener(workflowEventType, (event) => {
            try {
              const parsedData = JSON.parse(event.data) as DatabaseChangeData;

              connection!.subscribers.forEach((subKey) => {
                const callback = callbacksRef.current.get(subKey);
                if (callback) {
                  callback(parsedData);
                }
              });
            } catch (parseError) {
              console.error(
                `❌ [SSE Manager] Failed to parse ${workflowEventType} data:`,
                parseError,
              );
            }
          });
        }
      } else {
        // Add subscriber to existing connection
        connection.subscribers.add(subscriberKey);
        console.log(
          `➕ [SSE Manager] Added subscriber ${subscriberKey} to existing connection`,
        );
      }
    },
    [],
  );

  const unsubscribe = useCallback((subscriberKey: string) => {
    // Find and remove subscriber from all connections
    for (const [
      connectionKey,
      connection,
    ] of connectionsRef.current.entries()) {
      if (connection.subscribers.has(subscriberKey)) {
        connection.subscribers.delete(subscriberKey);
        callbacksRef.current.delete(subscriberKey);

        // If no more subscribers, close the connection
        if (connection.subscribers.size === 0) {
          console.log(
            "🔌 [SSE Manager] Closing connection (no more subscribers):",
            connectionKey,
          );
          connection.eventSource.close();
          connectionsRef.current.delete(connectionKey);
          statusRef.current.delete(connectionKey);
        }
        break;
      }
    }
  }, []);

  const getConnectionStatus = useCallback(
    (subscriberKey: string): SSEConnectionStatus => {
      for (const [
        connectionKey,
        connection,
      ] of connectionsRef.current.entries()) {
        if (connection.subscribers.has(subscriberKey)) {
          return statusRef.current.get(connectionKey) || "disconnected";
        }
      }
      return "disconnected";
    },
    [],
  );

  const contextValue = useMemo(
    () => ({
      subscribe,
      unsubscribe,
      getConnectionStatus,
    }),
    [subscribe, unsubscribe, getConnectionStatus],
  );

  return (
    <SSEManagerContext.Provider value={contextValue}>
      {children}
    </SSEManagerContext.Provider>
  );
};

// Hook to use SSE Manager
export const useSSEManager = () => {
  const context = useContext(SSEManagerContext);
  if (!context) {
    throw new Error("useSSEManager must be used within SSEManagerProvider");
  }
  return context;
};

export const useSharedSSE = (
  subscriberKey: string,
  options: {
    filters?: string;
    workflowId?: string;
    onEvent?: (data: DatabaseChangeData) => void;
    enabled?: boolean;
  } = {},
) => {
  const { enabled = true, filters, workflowId, onEvent } = options;
  const sseManager = useSSEManager();
  const [status, setStatus] = useState<SSEConnectionStatus>("disconnected");

  const onEventRef = useRef(onEvent);
  const isSubscribedRef = useRef(false);

  // Keep callback ref updated
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled || isSubscribedRef.current) return;

    console.log(`🔗 [SSE Manager] Subscribing: ${subscriberKey}`);
    isSubscribedRef.current = true;

    const stableOptions = {
      filters,
      workflowId,
      onEvent: onEventRef.current,
    };

    sseManager.subscribe(subscriberKey, stableOptions);

    const checkStatus = () => {
      const currentStatus = sseManager.getConnectionStatus(subscriberKey);
      setStatus(currentStatus);
    };

    const interval = setInterval(checkStatus, 1000);
    checkStatus();

    return () => {
      if (isSubscribedRef.current) {
        console.log(`🔌 [SSE Manager] Unsubscribing: ${subscriberKey}`);
        clearInterval(interval);
        sseManager.unsubscribe(subscriberKey);
        isSubscribedRef.current = false;
      }
    };
  }, [subscriberKey, enabled, filters, workflowId]);

  return { status, isConnected: status === "connected" };
};
