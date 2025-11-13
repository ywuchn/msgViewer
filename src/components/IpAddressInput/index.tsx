/**
 * IP 地址输入组件
 * 用于输入和验证 IP 地址和端口号
 */

import { useState } from 'react';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { validateIpAddress, validatePortNumber } from '../../utils/validation';

interface IpAddressInputProps {
  ipAddress: string;
  portNumber: string;
  onIpAddressChange: (value: string) => void;
  onPortNumberChange: (value: string) => void;
  onValidationChange: (isValid: boolean) => void;
}

export function IpAddressInput({
  ipAddress,
  portNumber,
  onIpAddressChange,
  onPortNumberChange,
  onValidationChange,
}: IpAddressInputProps) {
  const [ipValid, setIpValid] = useState(true);
  const [portValid, setPortValid] = useState(true);

  const handleIpChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onIpAddressChange(value);
    
    const isValid = validateIpAddress(value);
    setIpValid(isValid);
    onValidationChange(isValid && portValid);
  };

  const handlePortChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    onPortNumberChange(value);
    
    const isValid = validatePortNumber(value);
    setPortValid(isValid);
    onValidationChange(ipValid && isValid);
  };

  return (
    <Stack direction="row" spacing={1} alignItems="center">
      <TextField
        size="small"
        label="IP Address"
        value={ipAddress}
        onChange={handleIpChange}
        error={!ipValid}
        helperText={!ipValid ? 'Invalid IP address' : ''}
        sx={{ width: '160px' }}
        placeholder="127.0.0.1"
      />
      <Typography variant="body1" sx={{ mx: 0.5 }}>
        :
      </Typography>
      <TextField
        size="small"
        label="Port"
        value={portNumber}
        onChange={handlePortChange}
        error={!portValid}
        helperText={!portValid ? 'Invalid port (1-65535)' : ''}
        sx={{ width: '120px' }}
        placeholder="8810"
      />
    </Stack>
  );
}

