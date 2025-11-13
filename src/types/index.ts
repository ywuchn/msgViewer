/**
 * 类型定义文件
 * 集中管理所有 TypeScript 类型和接口
 */

export interface MessageReport {
  datetime: string;
  sender: string;
  receiver: string;
  messageId: string;
  payload: string;
}

export interface FrontEndCommand {
  command: string;
  content: string;
}

export enum FilterType {
  MessageId = 0,
  SourceId = 1,
  TargetId = 2,
}

export interface FilterProps {
  filterType: FilterType;
  filterData: string;
}

export interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

