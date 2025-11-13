import * as React from 'react';
import { useEffect, useState, useRef } from "react";
import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

import { DataGrid, GridColDef, GridRowSelectionModel, GridCallbackDetails } from '@mui/x-data-grid';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';

import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InboxIcon from '@mui/icons-material/Inbox';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import FilterListIcon from '@mui/icons-material/FilterList';
import MessageIcon from '@mui/icons-material/Message';
import PersonIcon from '@mui/icons-material/Person';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';

import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';

import { lightTheme } from './theme';

import "./App.css";

interface MessageReport {
  datetime: string;
  sender: string;
  receiver: string;
  messageId: string;
  payload: string;
}

interface FrontEndCommand {
  command: string;
  content: string;
}

function forwardConsole(
  fnName: "log" | "debug" | "info" | "warn" | "error",
  logger: (message: string) => Promise<void>,
) {
  const original = console[fnName];
  console[fnName] = (message) => {
    original(message);
    logger(message);
  };
}

interface IPAddressEditProps {
  ipAddress: string;
  portNumber: string;
  setIpAddress: React.Dispatch<React.SetStateAction<string>>;
  setPortNumber: React.Dispatch<React.SetStateAction<string>>;
  setEditGood: React.Dispatch<React.SetStateAction<boolean>>;
}

const ipv4SegmentRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

function isValidIpSegment(segment: string): boolean {
  return ipv4SegmentRegex.test(segment);
}

function checkIpAddress(ipAddress: string): boolean {
  if (typeof ipAddress !== "string") {
    return false;
  }

  if (ipAddress.trim() === "") {
    return true;
  }

  const segments = ipAddress.split(".");
  if (segments.length != 4) {
    return false;
  }

  for (let seg of segments) {
    if (!isValidIpSegment(seg)) {
      return false;
    }
  }
  return true;
}

function checkPortNumber(portNumber: string): boolean {
  const portRegex = /^(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3})$/;
  if (portNumber.length == 0) {
    return true;
  }
  return portRegex.test(portNumber);
}

const IpAddressEdit = ({ ipAddress, portNumber, setIpAddress, setPortNumber, setEditGood }: IPAddressEditProps) => {
  const [ipGood, setIpGood] = useState(true);
  const [portGood, setPortGood] = useState(true);

  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setIpAddress(value);
    if (checkIpAddress(value)) {
      setIpGood(true);
      setEditGood(portGood);
    } else {
      setIpGood(false);
      setEditGood(false);
    }
  }

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPortNumber(value);
    if (checkPortNumber(value)) {
      setPortGood(true);
      setEditGood(ipGood);
    } else {
      setPortGood(false);
      setEditGood(false);
    }
  }

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        size="small"
        label="IP Address"
        value={ipAddress}
        onChange={handleIpChange}
        error={!ipGood}
        helperText={!ipGood ? 'Invalid IP address' : ''}
        sx={{ width: '160px' }}
        placeholder="127.0.0.1"
      />
      <Typography variant="body1" sx={{ mx: 0.5 }}>:</Typography>
      <TextField
        size="small"
        label="Port"
        value={portNumber}
        onChange={handlePortChange}
        error={!portGood}
        helperText={!portGood ? 'Invalid port (1-65535)' : ''}
        sx={{ width: '120px' }}
        placeholder="8810"
      />
    </Stack>
  )
}

interface ToolbarProps {
  onRecvReport: (report: MessageReport) => void;
  setConfigPanelVisible: React.Dispatch<React.SetStateAction<boolean>>;
}
const Toolbar = ({ onRecvReport, setConfigPanelVisible }: ToolbarProps) => {
  const [ipAddress, setIpAddress] = useState("127.0.0.1");
  const [portNumber, setPortNumber] = useState("8810");
  const [addressGood, setAddressGood] = useState(true);
  const socketRef = useRef<WebSocket | null>(null);
  const [wsStarted, setWsStarted] = useState(false);
  const [configVisible, setConfigVisible] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

  async function webSocketStart() {
    if (!wsStarted) {
      info("webSocketStart");
      setWsStarted(true);
    }
  }

  async function webSocketAttach() {
    setConnectionStatus('connecting');
    const wsAddr = 'ws://localhost:8080';
    info("Create WebSocket to." + wsAddr);
    const ws = new WebSocket(wsAddr);
    if (!ws) {
      info("WebSocket is not connected.");
      setConnectionStatus('disconnected');
      return;
    }

    socketRef.current = ws;

    ws.onopen = function () {
      info("WebSocket connected.");
      setConnectionStatus('connected');
      if (socketRef.current) {
        try {
          const messageObject: FrontEndCommand = { command: "start_recv", content: ipAddress + ":" + portNumber };
          const messageJson = JSON.stringify(messageObject);
          info("Send WebSocket command." + messageJson);
          socketRef.current.send(messageJson);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
        }
      }
    };

    ws.onmessage = function (event) {
      try {
        const wsMessage = JSON.parse(event.data);
        if (wsMessage.event === "msg_updated") {
          const report: MessageReport = wsMessage.data as MessageReport;
          onRecvReport(report);
        }
        else if (wsMessage.event === "bc_monitor_started") {
          info("bc_monitor_started: " + JSON.stringify(wsMessage.data));
        }
        else if (wsMessage.event === "bc_monitor_stopped") {
          info("bc_monitor_stopped: " + JSON.stringify(wsMessage.data));
        }
        else if (wsMessage.event === "ws_started") {
          info("ws_started: " + JSON.stringify(wsMessage.data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = function (event) {
      console.error('WebSocket Error: ', event);
      setConnectionStatus('disconnected');
    };

    ws.onclose = function () {
      info("WebSocket closed.");
      setConnectionStatus('disconnected');
      socketRef.current = null;
    };

    if (!socketRef.current) {
      info("WebSocket is not connected.");
      setConnectionStatus('disconnected');
      return;
    }
  }

  async function webSocketStop() {
    info("webSocketStop");
    if (!socketRef.current) {
      info("WebSocket is not connected.");
      return;
    }

    try {
      const messageObject: FrontEndCommand = { command: "stop_recv", content: "" };
      const messageJson = JSON.stringify(messageObject);
      info("Send WebSocket command." + messageJson);
      socketRef.current.send(messageJson);
      socketRef.current.close();
      socketRef.current = null;
      setConnectionStatus('disconnected');
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      setConnectionStatus('disconnected');
    }
  }

  async function configPanelVisible() {
    if (configVisible) {
      setConfigPanelVisible(false);
    }
    else {
      setConfigPanelVisible(true);
    }
    setConfigVisible(!configVisible);
  }

  useEffect(() => {
    webSocketStart();

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []);

  return (
    <Paper 
      elevation={2} 
      sx={{ 
        p: 2, 
        mb: 2,
        borderRadius: 2,
      }}
    >
      <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
        <IpAddressEdit 
          ipAddress={ipAddress} 
          setIpAddress={setIpAddress} 
          portNumber={portNumber} 
          setPortNumber={setPortNumber} 
          setEditGood={setAddressGood} 
        />
        
        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />
        
        {/* 连接状态指示器 */}
        <Chip
          icon={
            connectionStatus === 'connected' ? <CheckCircleIcon /> : 
            connectionStatus === 'connecting' ? <HourglassEmptyIcon /> : 
            <ErrorIcon />
          }
          label={connectionStatus}
          color={connectionStatus === 'connected' ? 'success' : connectionStatus === 'connecting' ? 'warning' : 'default'}
          variant="outlined"
          size="small"
        />
        
        <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
          <Tooltip title="Start receiving messages">
            <Button 
              variant="contained" 
              disabled={!addressGood || connectionStatus === 'connected' || connectionStatus === 'connecting'}
              onClick={webSocketAttach}
              startIcon={<PlayArrowIcon />}
              color="primary"
            >
              Start
            </Button>
          </Tooltip>
          <Tooltip title="Stop receiving messages">
            <Button 
              variant="outlined" 
              disabled={connectionStatus === 'disconnected'}
              onClick={webSocketStop}
              startIcon={<StopIcon />}
            >
              Stop
            </Button>
          </Tooltip>
          <Tooltip title="Configuration">
            <Button 
              variant="outlined" 
              onClick={configPanelVisible}
              startIcon={<SettingsIcon />}
            >
              Config
            </Button>
          </Tooltip>
        </Stack>
      </Stack>
    </Paper>
  );
}

enum FilterType {
  MessageId = 0,
  SourceId = 1,
  TargetId = 2,
}

interface FilterProps {
  filterType: FilterType;
  filterData: string;
}


interface ConfigPanelProps {
  isVisible: boolean;
  onChange: (filterProps: FilterProps) => void;
}
const ConfigPanel = ({ isVisible, onChange }: ConfigPanelProps) => {
  const [msgFilterVisible, setMsgFilterVisible] = useState(true);
  const [tarFilterVisible, setTarFilterVisible] = useState(false);
  const [srcFilterVisible, setSrcFilterVisible] = useState(false);
  const [msgFilterData, setMsgFilterData] = useState('');
  const [srcFilterData, setSrcFilterData] = useState('');
  const [tarFilterData, setTarFilterData] = useState('');
  const [filterType, setFilterType] = useState<FilterType>(FilterType.MessageId);


  const handleFilterTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = (event.target as HTMLInputElement).value;
    if (value == "msgId") {
      setMsgFilterVisible(true);
      setSrcFilterVisible(false);
      setTarFilterVisible(false);
      setFilterType(FilterType.MessageId);
      onChange({ filterType: FilterType.MessageId, filterData: msgFilterData });
    } else if (value == "srcId") {
      setMsgFilterVisible(false);
      setSrcFilterVisible(true);
      setTarFilterVisible(false);
      setFilterType(FilterType.SourceId);
      onChange({ filterType: FilterType.SourceId, filterData: srcFilterData });
    } else if (value == "tarId") {
      setMsgFilterVisible(false);
      setSrcFilterVisible(false);
      setTarFilterVisible(true);
      setFilterType(FilterType.TargetId);
      onChange({ filterType: FilterType.TargetId, filterData: tarFilterData });
    }
  };

  const handleFilterDataChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    if (name == "msgId") {
      setMsgFilterData(value);
      if (filterType == FilterType.MessageId) {
        onChange({ filterType: FilterType.MessageId, filterData: value });
      }
    } else if (name == "srcId") {
      setSrcFilterData(value);
      if (filterType == FilterType.SourceId) {
        onChange({ filterType: FilterType.SourceId, filterData: value });
      }
    } else if (name == "tarId") {
      setTarFilterData(value);
      if (filterType == FilterType.TargetId) {
        onChange({ filterType: FilterType.TargetId, filterData: value });
      }
    }
  }

  return (
    <Collapse in={isVisible}>
      <Paper 
        elevation={1} 
        sx={{ 
          p: 2.5, 
          mb: 2,
          borderRadius: 2,
        }}
      >
        <Stack spacing={2.5}>
          {/* 标题区域 */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <FilterListIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Filter Configuration
            </Typography>
          </Box>
          
          {/* 主要内容区域 */}
          <Grid container spacing={3}>
            {/* 左侧：过滤类型选择 */}
            <Grid size={{ xs: 12, sm: 12, md: 4 }}>
              <Box sx={{ 
                p: 2, 
                bgcolor: 'action.hover', 
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider'
              }}>
                <FormLabel 
                  id="radiogroupslect" 
                  sx={{ 
                    mb: 2, 
                    display: 'block',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: 'text.primary'
                  }}
                >
                  Filter Type
                </FormLabel>
                <RadioGroup
                  defaultValue="msgId"
                  name="filter-type-group"
                  onChange={handleFilterTypeChange}
                  sx={{ gap: 1 }}
                >
                  <FormControlLabel 
                    value="msgId" 
                    control={<Radio size="small" />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <MessageIcon fontSize="small" color="action" />
                        <Typography variant="body2">Message ID</Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel 
                    value="srcId" 
                    control={<Radio size="small" />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography variant="body2">Sender</Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                  <FormControlLabel 
                    value="tarId" 
                    control={<Radio size="small" />} 
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <PersonOutlineIcon fontSize="small" color="action" />
                        <Typography variant="body2">Receiver</Typography>
                      </Box>
                    }
                    sx={{ m: 0 }}
                  />
                </RadioGroup>
              </Box>
            </Grid>
            
            {/* 右侧：过滤值输入 */}
            <Grid size={{ xs: 12, sm: 12, md: 8 }}>
              <Box sx={{ 
                p: 2,
                bgcolor: 'background.paper',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                minHeight: '100%',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Box sx={{ width: '100%' }}>
                  <Box sx={{ display: msgFilterVisible ? 'block' : 'none' }}>
                    <TextField 
                      fullWidth
                      label="Message ID Filter" 
                      variant="outlined" 
                      value={msgFilterData} 
                      onChange={handleFilterDataChange} 
                      name="msgId"
                      size="small"
                      placeholder="Enter message ID to filter"
                      helperText="Filter messages by their ID"
                    />
                  </Box>
                  <Box sx={{ display: srcFilterVisible ? 'block' : 'none' }}>
                    <TextField 
                      fullWidth
                      label="Sender Filter" 
                      variant="outlined" 
                      value={srcFilterData} 
                      onChange={handleFilterDataChange} 
                      name="srcId"
                      size="small"
                      placeholder="Enter sender ID to filter"
                      helperText="Filter messages by sender ID"
                    />
                  </Box>
                  <Box sx={{ display: tarFilterVisible ? 'block' : 'none' }}>
                    <TextField 
                      fullWidth
                      label="Receiver Filter" 
                      variant="outlined" 
                      value={tarFilterData} 
                      onChange={handleFilterDataChange} 
                      name="tarId"
                      size="small"
                      placeholder="Enter receiver ID to filter"
                      helperText="Filter messages by receiver ID"
                    />
                  </Box>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </Stack>
      </Paper>
    </Collapse>
  );
}

interface MessageReportProps {
  reports: MessageReport[];
}

const columns: GridColDef[] = [
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
interface TreeNode {
  id: string;
  label: string;
  children?: TreeNode[];
}

const buildMessageTree = (report: MessageReport): TreeNode => {
  const root: TreeNode = {
    id: 'root',
    label: 'Message',
    children: [
      {
        id: 'datetime',
        label: `Time: ${report.datetime}`
      },
      {
        id: 'messageId', 
        label: `Message ID: ${report.messageId}`
      },
      {
        id: 'sender',
        label: `Sender: ${report.sender}`
      },
      {
        id: 'receiver',
        label: `Receiver: ${report.receiver}`
      }
    ]
  };

  if (report.payload) {
    const bytes = report.payload.split(' ');
    const payloadNode: TreeNode = {
      id: 'payload',
      label: 'Payload',
      children: bytes.map((byte, index) => ({
        id: `byte-${index}`,
        label: `Byte ${index}: ${byte}`
      }))
    };
    root.children?.push(payloadNode);
  }

  return root;
};

const MessageTreeView = ({report}: {report: MessageReport}) => {
  const tree = buildMessageTree(report);
  
  return (
    <Paper elevation={1} sx={{ height: '100%', borderRadius: 2, p: 2, overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Message Details
      </Typography>
      <SimpleTreeView
        aria-label="message tree"
        defaultExpandedItems={['root', 'payload']}
      >
        {tree.children?.map((node) => (
          <TreeItem 
            key={node.id}
            itemId={node.id}
            label={node.label}
          >
            {node.children?.map((child) => (
              <TreeItem
                key={child.id} 
                itemId={child.id}
                label={child.label}
              />
            ))}
          </TreeItem>
        ))}
      </SimpleTreeView>
    </Paper>
  );
};

interface MessageGridProps extends MessageReportProps {
  onRowSelectionChange?: (selectedRowId: number | null) => void;
  selectedRowId?: number | null;
}

const MessageGrid = ({ reports, onRowSelectionChange, selectedRowId }: MessageGridProps) => {
  if (reports.length === 0) {
    return (
      <Paper 
        elevation={1}
        sx={{ 
          height: '100%',
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          borderRadius: 2,
        }}
      >
        <InboxIcon sx={{ fontSize: 64, mb: 2, opacity: 0.5, color: 'text.secondary' }} />
        <Typography variant="h6" color="text.secondary" gutterBottom>
          No messages received yet
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Click Start to begin receiving messages
        </Typography>
      </Paper>
    );
  }

  const handleRowSelectionModelChange = (newSelection: GridRowSelectionModel, _details: GridCallbackDetails<any>) => {
    if (onRowSelectionChange) {
      const selectedId = newSelection.length > 0 ? newSelection[0] as number : null;
      onRowSelectionChange(selectedId);
    }
  };

  return (
    <Paper elevation={1} sx={{ height: '100%', maxHeight: '100%', borderRadius: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', height: '100%', maxHeight: '100%' }}>
        <DataGrid
          rows={reports.map((report, index) => (
            { 
              id: index, 
              ts: report.datetime, 
              msgId: report.messageId, 
              sender: report.sender, 
              receiver: report.receiver, 
              payload: report.payload 
            }
          ))}
          columns={columns} 
          columnVisibilityModel={{
            id: false,
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: {
              paginationModel: { pageSize: 50 },
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
            '& .MuiDataGrid-root': {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
            },
            '& .MuiDataGrid-main': {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
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
              overflowX: 'auto',
              flex: 1,
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
          }}
        />
      </Box>
    </Paper>
  )
}

const App = () => {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [configPanelVisible, setConfigPanelVisible] = useState(true);
  const [selectedRowId, setSelectedRowId] = useState<number | null>(null);

  const [filter, setFilter] = useState<FilterProps>({ filterType: FilterType.MessageId, filterData: '' });

  forwardConsole("log", trace);
  forwardConsole("debug", debug);
  forwardConsole("info", info);
  forwardConsole("warn", warn);
  forwardConsole("error", error);

  const insertReport = (report: MessageReport) => {
    if (reports.length >= 1000) {
      reports.shift();
    }
    reports.push(report);
    setReports([...reports]);
  };

  const onFilterChange = (filterProps: FilterProps) => {
    setFilter(filterProps);
    setSelectedRowId(null);
    info("Filter changed: " + filterProps.filterType + " " + filterProps.filterData);
  };

  const FilterFunc = (report: MessageReport) => {
    if (filter.filterData == '') {
      return true;
    }
    if (filter.filterType == FilterType.MessageId) {
      return report.messageId == filter.filterData;
    } else if (filter.filterType == FilterType.SourceId) {
      return report.sender == filter.filterData;
    } else {
      return report.receiver == filter.filterData;
    }
  }

  return (
    <ThemeProvider theme={lightTheme}>
      <CssBaseline />
      <Box sx={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
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
            {/* toolbar */}
            <Box sx={{ flexShrink: 0 }}>
              <Toolbar onRecvReport={insertReport} setConfigPanelVisible={setConfigPanelVisible} />
            </Box>
            <Box sx={{ flexShrink: 0 }}>
              <ConfigPanel isVisible={configPanelVisible} onChange={onFilterChange} />
            </Box>
            {/* message display */}
            <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
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
                    reports={reports.filter(FilterFunc)} 
                    onRowSelectionChange={setSelectedRowId}
                    selectedRowId={selectedRowId}
                  />
                </Grid>
                {selectedRowId !== null && selectedRowId < reports.filter(FilterFunc).length && (
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
                    <MessageTreeView report={reports.filter(FilterFunc)[selectedRowId]} />
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
