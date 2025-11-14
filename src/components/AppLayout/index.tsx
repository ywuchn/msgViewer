/**
 * 应用布局组件
 * 负责应用的整体布局结构
 */

import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import { Toolbar } from '../Toolbar';
import { ConfigPanel } from '../ConfigPanel';
import { MessageGrid } from '../MessageGrid';
import { MessageTreeView } from '../MessageTreeView';
import {
  contentContainerSx,
  mainStackSx,
  messageDisplayAreaSx,
  gridContainerSx,
  gridItemSx,
} from '../../styles/layoutStyles';
import type { MessageReport, FilterProps } from '../../types';

interface AppLayoutProps {
  configPanelVisible: boolean;
  selectedRowId: number | null;
  filteredReports: MessageReport[];
  selectedReport: MessageReport | null;
  onMessageReceived: (report: MessageReport) => void;
  onConfigToggle: () => void;
  onFilterChange: (filterProps: FilterProps) => void;
  onRowSelectionChange: (id: number | null) => void;
}

export function AppLayout({
  configPanelVisible,
  selectedRowId,
  filteredReports,
  selectedReport,
  onMessageReceived,
  onConfigToggle,
  onFilterChange,
  onRowSelectionChange,
}: AppLayoutProps) {
  return (
    <Box sx={contentContainerSx}>
      <Stack spacing={2} sx={mainStackSx}>
        <Box sx={{ flexShrink: 0 }}>
          <Toolbar
            onMessageReceived={onMessageReceived}
            onConfigToggle={onConfigToggle}
          />
        </Box>
        <Box sx={{ flexShrink: 0 }}>
          <ConfigPanel
            isVisible={configPanelVisible}
            onChange={onFilterChange}
          />
        </Box>
        <Box sx={messageDisplayAreaSx}>
          <Grid 
            container 
            spacing={2} 
            sx={{
              ...gridContainerSx,
              // 确保 Grid 容器的 spacing 不会导致溢出
              '& > .MuiGrid2-root': {
                boxSizing: 'border-box',
              },
            }}
          >
            <Grid
              size={selectedRowId !== null ? 7 : 12}
              sx={gridItemSx}
            >
              <MessageGrid
                reports={filteredReports}
                onRowSelectionChange={onRowSelectionChange}
                selectedRowId={selectedRowId}
              />
            </Grid>
            {selectedReport && (
              <Grid size={5} sx={gridItemSx}>
                <MessageTreeView report={selectedReport} />
              </Grid>
            )}
          </Grid>
        </Box>
      </Stack>
    </Box>
  );
}

