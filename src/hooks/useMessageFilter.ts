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
  // 使用 filter.filterType 和 filter.filterData 作为依赖项，而不是整个 filter 对象
  // 这样可以避免因为 filter 对象引用变化导致的重新计算
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
  }, [reports, filter.filterType, filter.filterData]);
}

