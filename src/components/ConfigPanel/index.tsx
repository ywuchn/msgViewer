/**
 * 配置面板组件
 * 用于设置消息过滤条件
 */

import { useState } from 'react';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid2';
import FilterListIcon from '@mui/icons-material/FilterList';
import MessageIcon from '@mui/icons-material/Message';
import PersonIcon from '@mui/icons-material/Person';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import { FilterType, type FilterProps } from '../../types';

interface ConfigPanelProps {
  isVisible: boolean;
  onChange: (filterProps: FilterProps) => void;
}

export function ConfigPanel({ isVisible, onChange }: ConfigPanelProps) {
  const [msgFilterVisible, setMsgFilterVisible] = useState(true);
  const [tarFilterVisible, setTarFilterVisible] = useState(false);
  const [srcFilterVisible, setSrcFilterVisible] = useState(false);
  const [msgFilterData, setMsgFilterData] = useState('');
  const [srcFilterData, setSrcFilterData] = useState('');
  const [tarFilterData, setTarFilterData] = useState('');
  const [filterType, setFilterType] = useState<FilterType>(FilterType.MessageId);

  const handleFilterTypeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    
    if (value === "msgId") {
      setMsgFilterVisible(true);
      setSrcFilterVisible(false);
      setTarFilterVisible(false);
      setFilterType(FilterType.MessageId);
      onChange({ filterType: FilterType.MessageId, filterData: msgFilterData });
    } else if (value === "srcId") {
      setMsgFilterVisible(false);
      setSrcFilterVisible(true);
      setTarFilterVisible(false);
      setFilterType(FilterType.SourceId);
      onChange({ filterType: FilterType.SourceId, filterData: srcFilterData });
    } else if (value === "tarId") {
      setMsgFilterVisible(false);
      setSrcFilterVisible(false);
      setTarFilterVisible(true);
      setFilterType(FilterType.TargetId);
      onChange({ filterType: FilterType.TargetId, filterData: tarFilterData });
    }
  };

  const handleFilterDataChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    
    if (name === "msgId") {
      setMsgFilterData(value);
      if (filterType === FilterType.MessageId) {
        onChange({ filterType: FilterType.MessageId, filterData: value });
      }
    } else if (name === "srcId") {
      setSrcFilterData(value);
      if (filterType === FilterType.SourceId) {
        onChange({ filterType: FilterType.SourceId, filterData: value });
      }
    } else if (name === "tarId") {
      setTarFilterData(value);
      if (filterType === FilterType.TargetId) {
        onChange({ filterType: FilterType.TargetId, filterData: value });
      }
    }
  };

  return (
    <Collapse in={isVisible}>
      <Box
        sx={{
          width: '100%',
          px: 0.5, // 为左右阴影留出空间
          boxSizing: 'border-box',
        }}
      >
        <Paper
          elevation={1}
          sx={{
            p: 2.5,
            borderRadius: 2,
            overflow: 'hidden',
            boxSizing: 'border-box',
            width: '100%',
          }}
        >
          <Stack spacing={2.5}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <FilterListIcon color="primary" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Filter Configuration
              </Typography>
            </Box>

            <Grid 
              container 
              spacing={3}
              sx={{
                width: '100%',
                m: 0,
                boxSizing: 'border-box',
                '& > .MuiGrid2-root': {
                  boxSizing: 'border-box',
                },
              }}
            >
            <Grid size={{ xs: 12, sm: 12, md: 4 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'action.hover',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider'
                }}
              >
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

            <Grid size={{ xs: 12, sm: 12, md: 8 }}>
              <Box
                sx={{
                  p: 2,
                  bgcolor: 'background.paper',
                  borderRadius: 2,
                  border: '1px solid',
                  borderColor: 'divider',
                  minHeight: '100%',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
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
    </Box>
    </Collapse>
  );
}

