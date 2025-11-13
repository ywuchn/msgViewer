/**
 * 连接状态指示器组件
 * 显示 WebSocket 连接状态
 */

import Chip from '@mui/material/Chip';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import type { ConnectionStatus } from '../../types';

interface ConnectionStatusChipProps {
  status: ConnectionStatus;
}

export function ConnectionStatusChip({ status }: ConnectionStatusChipProps) {
  const getIcon = () => {
    switch (status) {
      case 'connected':
        return <CheckCircleIcon />;
      case 'connecting':
        return <HourglassEmptyIcon />;
      default:
        return <ErrorIcon />;
    }
  };

  const getColor = (): 'success' | 'warning' | 'default' => {
    switch (status) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Chip
      icon={getIcon()}
      label={status}
      color={getColor()}
      variant="outlined"
      size="small"
    />
  );
}

