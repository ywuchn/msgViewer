/**
 * 常量定义
 * 集中管理应用中的常量值
 */

import type { GridColDef } from '@mui/x-data-grid';

/**
 * DataGrid 列定义
 */
export const MESSAGE_GRID_COLUMNS: GridColDef[] = [
  {
    field: 'id',
    headerName: 'ID',
    width: 60,
  },
  {
    field: 'ts',
    headerName: 'Time',
    type: 'string',
    width: 180,
    editable: false,
  },
  {
    field: 'msgId',
    headerName: 'Message ID',
    width: 150,
    editable: false,
  },
  {
    field: 'sender',
    headerName: 'Sender',
    width: 120,
    editable: false,
  },
  {
    field: 'receiver',
    headerName: 'Receiver',
    width: 120,
    editable: false,
  },
  {
    field: 'payload',
    headerName: 'Payload',
    editable: false,
    flex: 1,
    minWidth: 200,
  },
];

/**
 * 分页选项
 */
export const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

/**
 * 默认分页大小
 */
export const DEFAULT_PAGE_SIZE = 50;

/**
 * 最大消息数量（超过此数量将自动删除最旧的消息）
 */
export const MAX_MESSAGES = 1000;

/**
 * WebSocket 服务器地址
 */
export const WEBSOCKET_SERVER_URL = 'ws://localhost:8080';

/**
 * 默认 IP 地址
 */
export const DEFAULT_IP_ADDRESS = '127.0.0.1';

/**
 * 默认端口号
 */
export const DEFAULT_PORT = '8810';

