/**
 * 布局样式常量
 * 集中管理应用中重复使用的布局样式
 */

import type { SxProps, Theme } from '@mui/material/styles';

/**
 * 主容器样式
 */
export const mainContainerSx: SxProps<Theme> = {
  height: '100vh',
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  position: 'relative',
};

/**
 * 内容容器样式
 */
export const contentContainerSx: SxProps<Theme> = {
  py: 2,
  px: 2,
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
  height: '100%',
  maxHeight: '100%',
};

/**
 * 主堆栈样式
 */
export const mainStackSx: SxProps<Theme> = {
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  maxHeight: '100%',
};

/**
 * 消息显示区域样式
 */
export const messageDisplayAreaSx: SxProps<Theme> = {
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '100%',
};

/**
 * Grid 容器样式
 */
export const gridContainerSx: SxProps<Theme> = {
  flex: 1,
  overflow: 'hidden',
  minHeight: 0,
  display: 'flex',
  height: '100%',
  maxHeight: '100%',
  m: 0,
  width: '100%',
  boxSizing: 'border-box', // 确保 padding 和 spacing 包含在宽度内
};

/**
 * Grid 项样式
 */
export const gridItemSx: SxProps<Theme> = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  overflow: 'hidden', // 保持 hidden，由内部组件处理阴影
  height: '100%',
  maxHeight: '100%',
  p: 0,
  boxSizing: 'border-box', // 确保 padding 包含在宽度内
};


