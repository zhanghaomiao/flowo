/**
 * SSE (Server-Sent Events) Configuration
 *
 * Environment Variables:
 * - VITE_DISABLE_SSE: Set to 'true' or '1' to globally disable SSE functionality
 * - VITE_SSE_RECONNECT_INTERVAL: Reconnection interval in milliseconds (default: 3000)
 * - VITE_SSE_MAX_RETRIES: Maximum number of reconnection attempts (default: 5)
 */
interface SSEConfig {
  enabled: boolean;
  reconnectInterval: number;
  maxRetries: number;
}

// Global SSE configuration
const getSSEConfig = (): SSEConfig => {
  // Check environment variables for SSE configuration
  const env = import.meta.env;
  const isSSEDisabled =
    env?.VITE_DISABLE_SSE === "true" || env?.VITE_DISABLE_SSE === "1";

  console.log(
    "isSSEDisabled",
    isSSEDisabled,
    env?.VITE_DISABLE_SSE,
    env?.VITE_SSE_RECONNECT_INTERVAL,
    env?.VITE_SSE_MAX_RETRIES,
  );

  return {
    enabled: !isSSEDisabled,
    reconnectInterval: parseInt(env?.VITE_SSE_RECONNECT_INTERVAL || "3000"),
    maxRetries: parseInt(env?.VITE_SSE_MAX_RETRIES || "5"),
  };
};

export const sseConfig = getSSEConfig();

// Helper function to check if SSE is globally enabled
export const isSSEEnabled = (): boolean => {
  return sseConfig.enabled;
};

// Helper function to get SSE configuration with defaults
export const getSSESettings = (overrides?: Partial<SSEConfig>): SSEConfig => {
  return {
    ...sseConfig,
    ...overrides,
  };
};
