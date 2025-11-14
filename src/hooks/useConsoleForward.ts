/**
 * Console 转发工具函数
 * 将浏览器 console 输出转发到 Tauri 日志系统
 */

import { warn, debug, trace, info, error } from "@tauri-apps/plugin-log";

type ConsoleMethod = "log" | "debug" | "info" | "warn" | "error";

// 标记是否已经初始化，防止重复初始化
let isInitialized = false;

function forwardConsole(
  fnName: ConsoleMethod,
  logger: (message: string) => Promise<void>,
) {
  const original = console[fnName];
  // 使用 try-catch 包装，避免日志记录本身出错导致循环
  console[fnName] = (message: unknown) => {
    try {
      original(message);
      // 异步调用 logger，避免阻塞
      logger(String(message)).catch(() => {
        // 静默处理错误，避免日志记录错误导致循环
      });
    } catch (e) {
      // 如果转发失败，至少保留原始 console 功能
      original(message);
    }
  };
}

/**
 * 设置 console 转发到 Tauri 日志系统
 * 将所有 console 方法（log, debug, info, warn, error）转发到对应的 Tauri 日志函数
 * 
 * 注意：此函数会修改全局 console 对象，建议在应用初始化时调用一次
 * 此函数是幂等的，多次调用只会初始化一次
 */
export function setupConsoleForward() {
  // 防止重复初始化
  if (isInitialized) {
    return;
  }
  
  try {
    forwardConsole("log", trace);
    forwardConsole("debug", debug);
    forwardConsole("info", info);
    forwardConsole("warn", warn);
    forwardConsole("error", error);
    isInitialized = true;
  } catch (e) {
    // 如果初始化失败，记录错误但不抛出，避免影响应用启动
    console.error("Failed to setup console forward:", e);
  }
}

