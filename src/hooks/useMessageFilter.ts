/**
 * 消息过滤 Hook
 * 管理消息过滤逻辑和状态
 */

import { useMemo } from 'react';
import type { MessageReport, FilterProps } from '../types';
import { FilterType } from '../types';

/**
 * 根据过滤条件过滤消息
 */
export function useMessageFilter(
  reports: MessageReport[],
  filter: FilterProps
): MessageReport[] {
  return useMemo(() => {
    if (filter.filterData === '') {
      return reports;
    }

    return reports.filter((report) => {
      switch (filter.filterType) {
        case FilterType.MessageId:
          return report.messageId === filter.filterData;
        case FilterType.SourceId:
          return report.sender === filter.filterData;
        case FilterType.TargetId:
          return report.receiver === filter.filterData;
        default:
          return true;
      }
    });
  }, [reports, filter]);
}

