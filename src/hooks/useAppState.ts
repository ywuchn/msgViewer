/**
 * 应用状态管理 Hook
 * 集中管理 App 组件的状态和业务逻辑
 */

import { useState, useCallback } from 'react';
import { info } from "@tauri-apps/plugin-log";
import type { MessageReport, FilterProps } from '../types';
import { FilterType } from '../types';
import { MAX_MESSAGES } from '../constants';

interface UseAppStateReturn {
  reports: MessageReport[];
  configPanelVisible: boolean;
  selectedRowId: number | null;
  filter: FilterProps;
  handleMessageReceived: (report: MessageReport) => void;
  handleFilterChange: (filterProps: FilterProps) => void;
  handleConfigToggle: () => void;
  setSelectedRowId: (id: number | null) => void;
}

/**
 * 应用状态管理 Hook
 */
export function useAppState(): UseAppStateReturn {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [configPanelVisible, setConfigPanelVisible] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterProps>({
    filterType: FilterType.MessageId,
    filterData: ''
  });

  const handleMessageReceived = useCallback((report: MessageReport) => {
    setReports((prevReports) => {
      const newReports = [...prevReports];
      if (newReports.length >= MAX_MESSAGES) {
        newReports.shift();
      }
      newReports.push(report);
      return newReports;
    });
  }, []);

  const handleFilterChange = useCallback((filterProps: FilterProps) => {
    setFilter(filterProps);
    setSelectedRowId(null);
    info(`Filter changed: ${filterProps.filterType} ${filterProps.filterData}`);
  }, []);

  const handleConfigToggle = useCallback(() => {
    setConfigPanelVisible((prev) => !prev);
  }, []);

  return {
    reports,
    configPanelVisible,
    selectedRowId,
    filter,
    handleMessageReceived,
    handleFilterChange,
    handleConfigToggle,
    setSelectedRowId,
  };
}


