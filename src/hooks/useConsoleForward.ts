/**
 * Console 转发 Hook
 * 将浏览器 console 输出转发到 Tauri 日志系统
 */

import { useEffect } from 'react';
import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

type ConsoleMethod = "log" | "debug" | "info" | "warn" | "error";

function forwardConsole(
  fnName: ConsoleMethod,
  logger: (message: string) => Promise<void>,
) {
  const original = console[fnName];
  console[fnName] = (message: unknown) => {
    original(message);
    logger(String(message));
  };
}

/**
 * 转发所有 console 方法到 Tauri 日志系统
 */
export function useConsoleForward() {
  useEffect(() => {
    forwardConsole("log", trace);
    forwardConsole("debug", debug);
    forwardConsole("info", info);
    forwardConsole("warn", warn);
    forwardConsole("error", error);
  }, []);
}

