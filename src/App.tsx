/**
 * 主应用组件
 * 负责应用初始化和主题配置
 */

import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import { lightTheme } from './theme';
import { AppLayout } from './components/AppLayout';
import { useMessageFilter } from './hooks/useMessageFilter';
import { useAppState } from './hooks/useAppState';
import { mainContainerSx } from './styles/layoutStyles';
import './App.css';

function App() {
  const {
    reports,
    configPanelVisible,
    selectedRowId,
    filter,
    handleMessageReceived,
    handleFilterChange,
    handleConfigToggle,
    setSelectedRowId,
  } = useAppState();

  const filteredReports = useMessageFilter(reports, filter);
  const selectedReport =
    selectedRowId !== null && selectedRowId < filteredReports.length
      ? filteredReports[selectedRowId]
      : null;

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={mainContainerSx}>
        <AppLayout
          configPanelVisible={configPanelVisible}
          selectedRowId={selectedRowId}
          filteredReports={filteredReports}
          selectedReport={selectedReport}
          onMessageReceived={handleMessageReceived}
          onConfigToggle={handleConfigToggle}
          onFilterChange={handleFilterChange}
          onRowSelectionChange={setSelectedRowId}
        />
      </Box>
    </ThemeProvider>
  );
}

export default App;
