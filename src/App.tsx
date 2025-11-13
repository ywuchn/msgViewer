import * as React from 'react';
import { useEffect, useState, useRef } from "react";

// Remove invoke import since we no longer need to call start_websocket command
// import { invoke } from "@tauri-apps/api/core";
// import { listen } from "@tauri-apps/api/event";
import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Collapse from '@mui/material/Collapse';
import Chip from '@mui/material/Chip';

import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
// import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
// import ChevronRightIcon from '@mui/icons-material/ExpandMore';
// import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
// import { TreeItem } from '@mui/x-tree-view/TreeItem';

// Icons
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InboxIcon from '@mui/icons-material/Inbox';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

import Typography from '@mui/material/Typography';
// import Grid from '@mui/material/Grid2';

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
  // info("ip address is: " + ipAddress + "");
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

  // info("port is: " + portNumber + "");
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

///////////////////////////////////////////////////////////////////////////////////////////////////
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
      // WebSocket server is now started automatically when the application starts
      // await invoke("start_websocket");
      setWsStarted(true);
    }
  }

  async function webSocketAttach() {
    setConnectionStatus('connecting');
    
    if (!socketRef.current) {
    }
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
        // Parse WebSocket message
        const wsMessage = JSON.parse(event.data);
        
        // Check message type and handle accordingly
        if (wsMessage.event === "msg_updated") {
          // Handle message update event
          const report: MessageReport = wsMessage.data as MessageReport;
          onRecvReport(report);
        }
        else if (wsMessage.event === "bc_monitor_started") {
          // Handle BC monitor start event
          info("bc_monitor_started: " + JSON.stringify(wsMessage.data));
        }
        else if (wsMessage.event === "bc_monitor_stopped") {
          // Handle BC monitor stop event
          info("bc_monitor_stopped: " + JSON.stringify(wsMessage.data));
        }
        else if (wsMessage.event === "ws_started") {
          // Handle WebSocket server start event
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

///////////////////////////////////////////////////////////////////////////////////////////////////

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
          p: 2, 
          mb: 2,
          borderRadius: 2,
        }}
      >
        <Stack
          direction="row"
          divider={<Divider orientation="vertical" flexItem />}
          spacing={3}
          flexWrap="wrap"
        >
          <Box sx={{ minWidth: 200 }}>
            <FormLabel id="radiogroupslect" sx={{ mb: 1, display: 'block' }}>
              Filter Type
            </FormLabel>
            <RadioGroup
              defaultValue="msgId"
              name="filter-type-group"
              onChange={handleFilterTypeChange}
            >
              <FormControlLabel value="msgId" control={<Radio />} label="Message ID" />
              <FormControlLabel value="srcId" control={<Radio />} label="Sender" />
              <FormControlLabel value="tarId" control={<Radio />} label="Receiver" />
            </RadioGroup>
          </Box>
          
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Stack spacing={2}>
              <Box sx={{ display: msgFilterVisible ? 'block' : 'none' }}>
                <TextField 
                  fullWidth
                  label="Message ID" 
                  variant="outlined" 
                  value={msgFilterData} 
                  onChange={handleFilterDataChange} 
                  name="msgId"
                  size="small"
                />
              </Box>
              <Box sx={{ display: srcFilterVisible ? 'block' : 'none' }}>
                <TextField 
                  fullWidth
                  label="Sender" 
                  variant="outlined" 
                  value={srcFilterData} 
                  onChange={handleFilterDataChange} 
                  name="srcId"
                  size="small"
                />
              </Box>
              <Box sx={{ display: tarFilterVisible ? 'block' : 'none' }}>
                <TextField 
                  fullWidth
                  label="Receiver" 
                  variant="outlined" 
                  value={tarFilterData} 
                  onChange={handleFilterDataChange} 
                  name="tarId"
                  size="small"
                />
              </Box>
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Collapse>
  );
}

///////////////////////////////////////////////////////////////////////////////////////////////////

interface MessageReportProps {
  reports: MessageReport[];
}

// const MessageTable = ({ reports }: MessageReportProps) => {
//   return (
//     <div className="message-table-container">
//       <table className="message-table">
//         <thead>
//           <tr>
//             <th className="col1">DateTime</th>
//             <th className="col2">MessageID</th>
//             <th className="col3">Sender</th>
//             <th className="col4">Receiver</th>
//             <th className="col5">Payload</th>
//           </tr>
//         </thead>
//         <tbody>
//           {reports.map((report, index) => (
//             <tr key={index}>
//               <td className="col1">{report.datetime}</td>
//               <td className="col2">{report.messageId}</td>
//               <td className="col3">{report.sender}</td>
//               <td className="col4">{report.receiver}</td>
//               <td className="col5">{report.payload}</td>
//             </tr>
//           ))}
//         </tbody>
//       </table>
//     </div>
//   )
// }

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
// interface TreeNode {
//   id: string;
//   label: string;
//   children?: TreeNode[];
// }

// const buildMessageTree = (report: MessageReport): TreeNode => {
//   const root: TreeNode = {
//     id: 'root',
//     label: 'Message',
//     children: [
//       {
//         id: 'datetime',
//         label: `Time: ${report.datetime}`
//       },
//       {
//         id: 'messageId', 
//         label: `Message ID: ${report.messageId}`
//       },
//       {
//         id: 'sender',
//         label: `Sender: ${report.sender}`
//       },
//       {
//         id: 'receiver',
//         label: `Receiver: ${report.receiver}`
//       }
//     ]
//   };
//
//   // Split payload into bytes and create nodes
//   if (report.payload) {
//     const bytes = report.payload.split(' ');
//     const payloadNode: TreeNode = {
//       id: 'payload',
//       label: 'Payload',
//       children: bytes.map((byte, index) => ({
//         id: `byte-${index}`,
//         label: `Byte ${index}: ${byte}`
//       }))
//     };
//     root.children?.push(payloadNode);
//   }
//
//   return root;
// };

// const MessageTreeView = ({report}: {report: MessageReport}) => {
//   const tree = buildMessageTree(report);
//   
//   return (
//     <SimpleTreeView
//       aria-label="message tree"
//       defaultExpandedItems={['root']}
//     >
//       {tree.children?.map((node) => (
//         <TreeItem 
//           key={node.id}
//           itemId={node.id}
//           label={node.label}
//         >
//           {node.children?.map((child) => (
//             <TreeItem
//               key={child.id} 
//               itemId={child.id}
//               label={child.label}
//             />
//           ))}
//         </TreeItem>
//       ))}
//     </SimpleTreeView>
//   );
// };

const MessageGrid = ({ reports } : MessageReportProps) => {
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

  return (
    <Paper elevation={1} sx={{ height: '100%', borderRadius: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        sx={{
          border: 'none',
          flex: 1,
          '& .MuiDataGrid-cell:focus': {
            outline: 'none',
          },
        }}
      />
    </Paper>
  )
}

const App = () => {
  const [reports, setReports] = useState<MessageReport[]>([]);
  const [configPanelVisible, setConfigPanelVisible] = useState(true);

  const [filter, setFilter] = useState<FilterProps>({ filterType: FilterType.MessageId, filterData: '' });

  forwardConsole("log", trace);
  forwardConsole("debug", debug);
  forwardConsole("info", info);
  forwardConsole("warn", warn);
  forwardConsole("error", error);

  const insertReport = (report: MessageReport) => {
    // info("Recv:[" + report.datetime + "][" + report.sender + "=>" + report.receiver + "][" + report.messageId + "]:" + report.payload);
    // if (reports.length >= 1000) {
    //   const updatedReports = [...reports.slice(1), report];
    //   setReports(updatedReports);
    // } else {
    //   setReports((prevReports) => [...prevReports, report]);
    // }

    if (reports.length >= 1000) {
      reports.shift();
    };
    reports.push(report);
    setReports([...reports]);
  };

  const onFilterChange = (filterProps: FilterProps) => {
    setFilter(filterProps);
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
      <Box sx={{ height: '100vh', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Container maxWidth={false} sx={{ py: 2, px: 2, height: '100%', display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <Stack spacing={2} sx={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            {/* toolbar */}
            <Toolbar onRecvReport={insertReport} setConfigPanelVisible={setConfigPanelVisible} />
            <ConfigPanel isVisible={configPanelVisible} onChange={onFilterChange} />
            {/* message display */}
            <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              <MessageGrid reports={reports.filter(FilterFunc)} />
            </Box>
          </Stack>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default App;
