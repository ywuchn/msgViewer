/**
 * WebSocket 连接管理 Hook
 * 封装 WebSocket 连接逻辑和状态管理
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { info } from "@tauri-apps/plugin-log";
import type { MessageReport, FrontEndCommand, ConnectionStatus } from '../types';
import { WEBSOCKET_SERVER_URL } from '../constants';

interface UseWebSocketOptions {
  ipAddress: string;
  portNumber: string;
  onMessageReceived: (report: MessageReport) => void;
}

interface UseWebSocketReturn {
  connectionStatus: ConnectionStatus;
  connect: () => void;
  disconnect: () => void;
  isConnected: boolean;
}

/**
 * WebSocket 连接管理 Hook
 */
export function useWebSocket({
  ipAddress,
  portNumber,
  onMessageReceived,
}: UseWebSocketOptions): UseWebSocketReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const socketRef = useRef<WebSocket | null>(null);
  const onMessageReceivedRef = useRef(onMessageReceived);
  const ipAddressRef = useRef(ipAddress);
  const portNumberRef = useRef(portNumber);

  // 在每次渲染时更新 ref，避免在 useEffect 中依赖回调函数
  // 这样可以防止因为回调函数引用变化导致的无限更新
  onMessageReceivedRef.current = onMessageReceived;
  ipAddressRef.current = ipAddress;
  portNumberRef.current = portNumber;

  const connect = useCallback(() => {
    setConnectionStatus('connecting');

    const ws = new WebSocket(WEBSOCKET_SERVER_URL);
    if (!ws) {
      info("WebSocket is not connected.");
      setConnectionStatus('disconnected');
      return;
    }

    socketRef.current = ws;

    ws.onopen = () => {
      info("WebSocket connected.");
      setConnectionStatus('connected');
      if (socketRef.current) {
        try {
          const messageObject: FrontEndCommand = {
            command: "start_recv",
            content: `${ipAddressRef.current}:${portNumberRef.current}`
          };
          const messageJson = JSON.stringify(messageObject);
          info("Send WebSocket command: " + messageJson);
          socketRef.current.send(messageJson);
        } catch (error) {
          console.error('Error sending WebSocket message:', error);
        }
      }
    };

    ws.onmessage = (event) => {
      try {
        const wsMessage = JSON.parse(event.data);
        if (wsMessage.event === "msg_updated") {
          const report: MessageReport = wsMessage.data as MessageReport;
          onMessageReceivedRef.current(report);
        } else if (wsMessage.event === "bc_monitor_started") {
          info("bc_monitor_started: " + JSON.stringify(wsMessage.data));
        } else if (wsMessage.event === "bc_monitor_stopped") {
          info("bc_monitor_stopped: " + JSON.stringify(wsMessage.data));
        } else if (wsMessage.event === "ws_started") {
          info("ws_started: " + JSON.stringify(wsMessage.data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    ws.onerror = () => {
      console.error('WebSocket Error');
      setConnectionStatus('disconnected');
    };

    ws.onclose = () => {
      info("WebSocket closed.");
      setConnectionStatus('disconnected');
      socketRef.current = null;
    };
  }, []);

  const disconnect = useCallback(() => {
    info("webSocketStop");
    if (!socketRef.current) {
      info("WebSocket is not connected.");
      return;
    }

    try {
      const messageObject: FrontEndCommand = { command: "stop_recv", content: "" };
      const messageJson = JSON.stringify(messageObject);
      info("Send WebSocket command: " + messageJson);
      socketRef.current.send(messageJson);
      socketRef.current.close();
      socketRef.current = null;
      setConnectionStatus('disconnected');
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      setConnectionStatus('disconnected');
    }
  }, []);

  // 清理函数：组件卸载时关闭 WebSocket 连接
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, []); // 空依赖数组，只在组件卸载时执行清理

  return {
    connectionStatus,
    connect,
    disconnect,
    isConnected: connectionStatus === 'connected',
  };
}

