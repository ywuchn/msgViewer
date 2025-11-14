/**
 * 空状态组件
 * 当没有消息时显示
 */

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import InboxIcon from '@mui/icons-material/Inbox';

export function EmptyState() {
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

