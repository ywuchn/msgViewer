import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { setupConsoleForward } from "./hooks/useConsoleForward";

// 在 React 渲染之前初始化 console 转发
// 这样可以避免在组件生命周期中修改全局对象导致的无限更新问题
setupConsoleForward();

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
