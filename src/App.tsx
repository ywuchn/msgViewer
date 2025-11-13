/**
 * 主应用组件
 * 负责整体布局和状态管理
 */

import { useState, useCallback } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Grid from '@mui/material/Grid2';
import { info } from "@tauri-apps/plugin-log";
import { lightTheme } from './theme';
import { Toolbar } from './components/Toolbar';
import { ConfigPanel } from './components/ConfigPanel';
import { MessageGrid } from './components/MessageGrid';
import { MessageTreeView } from './components/MessageTreeView';
import { useConsoleForward } from './hooks/useConsoleForward';
import { useMessageFilter } from './hooks/useMessageFilter';
import { FilterType, type MessageReport, type FilterProps } from './types';
import { MAX_MESSAGES } from './constants';
import './App.css';

function App() {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [configPanelVisible, setConfigPanelVisible] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);
  const [filter, setFilter] = useState<FilterProps>({
    filterType: FilterType.MessageId,
    filterData: ''
  });

  useConsoleForward();

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

  const filteredReports = useMessageFilter(reports, filter);
  const selectedReport = selectedRowId !== null && 
    selectedRowId < filteredReports.length 
    ? filteredReports[selectedRowId] 
    : null;

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box
        sx={{
          height: '100vh',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        <Box
          sx={{
            py: 2,
            px: 2,
            display: 'flex',
            flexDirection: 'column',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
            height: '100%',
            maxHeight: '100%',
          }}
        >
          <Stack
            spacing={2}
            sx={{
              flex: 1,
              overflow: 'hidden',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              maxHeight: '100%',
            }}
          >
            <Box sx={{ flexShrink: 0 }}>
              <Toolbar
                onMessageReceived={handleMessageReceived}
                onConfigToggle={handleConfigToggle}
              />
            </Box>
            <Box sx={{ flexShrink: 0 }}>
              <ConfigPanel
                isVisible={configPanelVisible}
                onChange={handleFilterChange}
              />
            </Box>
            <Box
              sx={{
                flex: 1,
                overflow: 'hidden',
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                maxHeight: '100%'
              }}
            >
              <Grid
                container
                spacing={2}
                sx={{
                  flex: 1,
                  overflow: 'hidden',
                  minHeight: 0,
                  display: 'flex',
                  height: '100%',
                  maxHeight: '100%',
                  m: 0,
                  width: '100%',
                }}
              >
                <Grid
                  size={selectedRowId !== null ? 7 : 12}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: 0,
                    overflow: 'hidden',
                    height: '100%',
                    maxHeight: '100%',
                    p: 0,
                  }}
                >
                  <MessageGrid
                    reports={filteredReports}
                    onRowSelectionChange={setSelectedRowId}
                    selectedRowId={selectedRowId}
                  />
                </Grid>
                {selectedReport && (
                  <Grid
                    size={5}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      minHeight: 0,
                      overflow: 'hidden',
                      height: '100%',
                      maxHeight: '100%',
                      p: 0,
                    }}
                  >
                    <MessageTreeView report={selectedReport} />
                  </Grid>
                )}
              </Grid>
            </Box>
          </Stack>
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
