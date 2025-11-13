/**
 * 工具栏组件
 * 包含 IP 地址输入、连接控制和配置按钮
 */

import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Tooltip from '@mui/material/Tooltip';
import Divider from '@mui/material/Divider';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import SettingsIcon from '@mui/icons-material/Settings';
import { IpAddressInput } from '../IpAddressInput';
import { ConnectionStatusChip } from '../ConnectionStatusChip';
import { useWebSocket } from '../../hooks/useWebSocket';
import { DEFAULT_IP_ADDRESS, DEFAULT_PORT } from '../../constants';
import type { MessageReport } from '../../types';

interface ToolbarProps {
  onMessageReceived: (report: MessageReport) => void;
  onConfigToggle: () => void;
}

export function Toolbar({ onMessageReceived, onConfigToggle }: ToolbarProps) {
  const [ipAddress, setIpAddress] = useState(DEFAULT_IP_ADDRESS);
  const [portNumber, setPortNumber] = useState(DEFAULT_PORT);
  const [addressValid, setAddressValid] = useState(true);

  const { connectionStatus, connect, disconnect } = useWebSocket({
    ipAddress,
    portNumber,
    onMessageReceived,
  });

  const isStartDisabled = !addressValid || 
    connectionStatus === 'connected' || 
    connectionStatus === 'connecting';
  
  const isStopDisabled = connectionStatus === 'disconnected';

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
        <IpAddressInput
          ipAddress={ipAddress}
          portNumber={portNumber}
          onIpAddressChange={setIpAddress}
          onPortNumberChange={setPortNumber}
          onValidationChange={setAddressValid}
        />

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <ConnectionStatusChip status={connectionStatus} />

        <Stack direction="row" spacing={1} sx={{ ml: 'auto' }}>
          <Tooltip title="Start receiving messages">
            <Button
              variant="contained"
              disabled={isStartDisabled}
              onClick={connect}
              startIcon={<PlayArrowIcon />}
              color="primary"
            >
              Start
            </Button>
          </Tooltip>
          <Tooltip title="Stop receiving messages">
            <Button
              variant="outlined"
              disabled={isStopDisabled}
              onClick={disconnect}
              startIcon={<StopIcon />}
            >
              Stop
            </Button>
          </Tooltip>
          <Tooltip title="Configuration">
            <Button
              variant="outlined"
              onClick={onConfigToggle}
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

