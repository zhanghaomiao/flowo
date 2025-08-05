import { useCallback, useState } from "react";

export interface WorkflowState {
  selectedRule: string | null;
  highlightedRule: string | null;
  activeTab: string;
}

export const useWorkflowState = () => {
  const [state, setState] = useState<WorkflowState>({
    selectedRule: null,
    highlightedRule: null,
    activeTab: "jobs",
  });

  const setSelectedRule = useCallback((rule: string | null) => {
    setState((prev) => ({ ...prev, selectedRule: rule }));
  }, []);

  const setHighlightedRule = useCallback((rule: string | null) => {
    setState((prev) => ({ ...prev, highlightedRule: rule }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState((prev) => ({ ...prev, activeTab: tab }));
  }, []);

  const clearRuleFilter = useCallback(() => {
    setState((prev) => ({ ...prev, selectedRule: null }));
  }, []);

  const handleJobSelect = useCallback(
    (
      jobInfo: {
        jobId: string;
        ruleName: string;
        startTime: string;
        endTime: string;
        status: string;
      } | null,
    ) => {
      if (jobInfo) {
        setState((prev) => ({ ...prev, highlightedRule: jobInfo.ruleName }));
      } else {
        setState((prev) => ({ ...prev, highlightedRule: null }));
      }
    },
    [],
  );

  return {
    ...state,
    setSelectedRule,
    setHighlightedRule,
    setActiveTab,
    clearRuleFilter,
    handleJobSelect,
  };
};
