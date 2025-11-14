/**
 * 消息网格组件
 * 使用 DataGrid 显示消息列表
 */

import { useMemo, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import { DataGrid, GridRowSelectionModel, GridCallbackDetails } from '@mui/x-data-grid';
import { EmptyState } from '../EmptyState';
import { MESSAGE_GRID_COLUMNS, PAGE_SIZE_OPTIONS, DEFAULT_PAGE_SIZE } from '../../constants';
import type { MessageReport } from '../../types';

interface MessageGridProps {
  reports: MessageReport[];
  onRowSelectionChange?: (selectedRowId: number | null) => void;
  selectedRowId?: number | null;
}

export function MessageGrid({
  reports,
  onRowSelectionChange,
  selectedRowId,
}: MessageGridProps) {
  if (reports.length === 0) {
    return <EmptyState />;
  }

  // 使用 useCallback 稳定回调函数，避免每次渲染都创建新函数
  const handleRowSelectionModelChange = useCallback((
    newSelection: GridRowSelectionModel,
    _details: GridCallbackDetails<any>
  ) => {
    if (onRowSelectionChange) {
      const selectedId = newSelection.length > 0 ? (newSelection[0] as number) : null;
      onRowSelectionChange(selectedId);
    }
  }, [onRowSelectionChange]);

  // 使用 useMemo 稳定 rows 数组，避免每次渲染都创建新数组
  const rows = useMemo(() => {
    return reports.map((report, index) => ({
      id: index,
      ts: report.datetime,
      msgId: report.messageId,
      sender: report.sender,
      receiver: report.receiver,
      payload: report.payload
    }));
  }, [reports]);

  return (
    <Box
      sx={{
        height: '100%',
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        p: 0.5, // 为阴影留出空间
        boxSizing: 'border-box',
      }}
    >
      <Paper
        elevation={1}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 2,
          overflow: 'hidden',
          minHeight: 0,
          height: '100%',
          maxHeight: '100%',
        }}
      >
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
            height: '100%',
            maxHeight: '100%',
            p: 1, // 添加内边距，避免内容贴边
            boxSizing: 'border-box',
          }}
        >
        <DataGrid
          rows={rows}
          columns={MESSAGE_GRID_COLUMNS}
          columnVisibilityModel={{
            id: false,
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          initialState={{
            pagination: {
              paginationModel: { pageSize: DEFAULT_PAGE_SIZE },
            },
          }}
          rowSelectionModel={selectedRowId !== null && selectedRowId !== undefined ? [selectedRowId] : []}
          onRowSelectionModelChange={handleRowSelectionModelChange}
          checkboxSelection={false}
          disableRowSelectionOnClick={false}
          autoHeight={false}
          sx={{
            border: 'none',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            width: '100%', // 确保宽度正确
            '& .MuiDataGrid-root': {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              width: '100%',
              margin: 0,
            },
            '& .MuiDataGrid-main': {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              width: '100%',
            },
            '& .MuiDataGrid-container--top [role="row"]': {
              display: 'flex',
            },
            '& .MuiDataGrid-cell:focus': {
              outline: 'none',
            },
            '& .MuiDataGrid-row:hover': {
              cursor: 'pointer',
            },
            '& .MuiDataGrid-virtualScroller': {
              overflowY: 'auto !important',
              overflowX: 'auto !important', // 确保水平滚动正确
              flex: 1,
              width: '100%',
              '&::-webkit-scrollbar': {
                width: '8px',
                height: '8px',
              },
              '&::-webkit-scrollbar-track': {
                backgroundColor: 'rgba(0, 0, 0, 0.05)',
                borderRadius: '4px',
              },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                '&:hover': {
                  backgroundColor: 'rgba(0, 0, 0, 0.3)',
                },
              },
            },
            '& .MuiDataGrid-footerContainer': {
              borderTop: '1px solid rgba(224, 224, 224, 1)',
              minHeight: '52px',
              flexShrink: 0,
            },
            '& .MuiDataGrid-columnHeaders': {
              overflow: 'hidden', // 防止表头溢出
            },
          }}
        />
        </Box>
      </Paper>
    </Box>
  );
}

