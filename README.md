# Message Viewer

一个基于 Tauri + React 的跨平台消息查看器应用，用于实时监控和查看来自 BC 设备的二进制消息。

## ? 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [架构设计](#架构设计)
- [快速开始](#快速开始)
- [使用说明](#使用说明)
- [项目结构](#项目结构)
- [开发指南](#开发指南)
- [协议说明](#协议说明)
- [常见问题](#常见问题)

## ? 功能特性

- ? **实时消息监控**：通过 TCP 连接实时接收 BC 设备消息
- ? **消息可视化**：以表格形式展示消息详情（时间、消息ID、发送者、接收者、载荷）
- ? **消息过滤**：支持按消息ID、发送者、接收者进行过滤
- ? **WebSocket 通信**：前后端通过 WebSocket 实现双向实时通信
- ? **现代化 UI**：基于 Material-UI 的响应式界面
- ? **自动启动**：WebSocket 服务器在应用启动时自动运行
- ? **高性能**：基于 Rust 异步运行时，支持高并发消息处理

## ? 技术栈

### 前端
- **React 18** - UI 框架
- **TypeScript** - 类型安全
- **Material-UI (MUI)** - UI 组件库
- **Vite** - 构建工具
- **WebSocket API** - 实时通信

### 后端
- **Rust** - 系统编程语言
- **Tauri 2** - 跨平台应用框架
- **Tokio** - 异步运行时
- **tokio-tungstenite** - WebSocket 服务器
- **serde** - 序列化/反序列化
- **byteorder** - 字节序处理

## ? 架构设计

### 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     前端 (React + TypeScript)                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   App.tsx    │  │  Toolbar     │  │ MessageGrid  │      │
│  └──────┬───────┘  └──────┬───────┘  └──────────────┘      │
│         │                 │                                  │
│         └─────────┬───────┘                                  │
│                   │ WebSocket (ws://localhost:8080)         │
└───────────────────┼─────────────────────────────────────────┘
                    │
┌───────────────────┼─────────────────────────────────────────┐
│                   │           后端 (Rust + Tauri)           │
│         ┌─────────▼─────────┐                               │
│         │  WebSocket Server │                               │
│         │  (websocket.rs)   │                               │
│         └─────────┬─────────┘                               │
│                   │                                          │
│         ┌─────────▼─────────┐                               │
│         │  BC Communicator  │                               │
│         │   (bc_comm.rs)     │                               │
│         └─────────┬─────────┘                               │
│                   │ TCP                                      │
└───────────────────┼─────────────────────────────────────────┘
                    │
         ┌──────────▼──────────┐
         │  外部 BC 设备        │
         │  (TCP Server)       │
         └─────────────────────┘
```

### 核心模块

#### 后端模块

- **`lib.rs`** - 应用入口，初始化 WebSocket 服务器
- **`websocket.rs`** - WebSocket 服务器实现，处理前端连接和消息转发
- **`bc_comm.rs`** - BC 设备通信模块，处理 TCP 连接和消息解析
- **`models.rs`** - 数据模型定义（MessageReport, FrontEndCommand 等）
- **`utils.rs`** - 工具函数（消息ID映射、节点名称映射等）
- **`app_state.rs`** - 全局状态管理（WebSocket 和 BC 通信状态）

#### 前端组件

- **`App.tsx`** - 主应用组件
- **`Toolbar`** - 工具栏组件，管理 WebSocket 连接和 BC 通信
- **`ConfigPanel`** - 配置面板，提供消息过滤功能
- **`MessageGrid`** - 消息展示组件，使用 MUI DataGrid

### 通信协议

#### WebSocket 消息格式

**前端 → 后端（命令）**：
```json
{
  "command": "start_recv" | "stop_recv",
  "content": "ip:port"  // 仅 start_recv 需要
}
```

**后端 → 前端（事件）**：
```json
{
  "event": "msg_updated" | "bc_monitor_started" | "bc_monitor_stopped",
  "data": { ... }
}
```

## ? 快速开始

### 环境要求

- **Node.js** >= 18.0.0
- **Rust** >= 1.70.0
- **yarn** 或 **npm**

### 安装依赖

```bash
# 安装前端依赖
yarn install

# 安装 Rust 依赖（首次运行时会自动安装）
# 或手动运行
cd src-tauri
cargo build
```

### 开发模式

```bash
# 启动开发服务器
yarn tauri dev
```

应用将在开发模式下启动，支持热重载。

### 构建生产版本

```bash
# 构建应用
yarn tauri build
```

构建产物位于 `src-tauri/target/release/` 目录。

## ? 使用说明

### 启动应用

1. 运行 `yarn tauri dev` 启动应用
2. WebSocket 服务器会自动在 `ws://localhost:8080` 启动
3. 前端会自动连接到 WebSocket 服务器

### 连接 BC 设备

1. 在工具栏输入 BC 设备的 IP 地址和端口（例如：`127.0.0.1:8810`）
2. 点击 **Start** 按钮开始接收消息
3. 应用会通过 TCP 连接到 BC 设备并开始接收消息

### 查看消息

- 消息会自动显示在消息表格中
- 每条消息包含：
  - **DateTime**: 消息时间戳
  - **MessageID**: 消息ID（十六进制或名称）
  - **Sender**: 发送者节点名称
  - **Receiver**: 接收者节点名称
  - **Payload**: 消息载荷（十六进制格式）

### 过滤消息

1. 点击 **Config** 按钮打开配置面板
2. 选择过滤类型：
   - **Message ID**: 按消息ID过滤
   - **Sender**: 按发送者过滤
   - **Receiver**: 按接收者过滤
3. 输入过滤条件，表格会自动更新

### 停止接收

点击 **Stop** 按钮停止接收消息并断开与 BC 设备的连接。

## ? 项目结构

```
msgViewer/
├── src/                      # 前端源代码
│   ├── App.tsx              # 主应用组件
│   ├── App.css              # 样式文件
│   └── main.tsx             # 入口文件
├── src-tauri/               # Tauri 后端
│   ├── src/
│   │   ├── lib.rs           # 应用入口
│   │   ├── websocket.rs     # WebSocket 服务器
│   │   ├── bc_comm.rs       # BC 通信模块
│   │   ├── models.rs        # 数据模型
│   │   ├── utils.rs         # 工具函数
│   │   └── app_state.rs     # 状态管理
│   ├── Cargo.toml           # Rust 依赖配置
│   └── tauri.conf.json      # Tauri 配置
├── package.json              # Node.js 依赖配置
├── vite.config.ts           # Vite 配置
└── README.md                # 项目文档
```

## ? 开发指南

### 添加新的消息类型

1. 在 `src-tauri/src/lib.rs` 中添加消息ID常量：
```rust
const MSG_NEW_MESSAGE: u16 = 0xXXXX;
```

2. 在 `src-tauri/src/utils.rs` 的 `get_msg_name` 函数中添加映射：
```rust
MSG_NEW_MESSAGE => "MSG_NEW_MESSAGE",
```

### 添加新的 WebSocket 事件

1. 在后端发送事件：
```rust
if let Ok(msg) = serde_json::to_string(&json!({
    "event": "new_event",
    "data": { ... }
})) {
    // 通过 WebSocket 发送
}
```

2. 在前端处理事件：
```typescript
if (wsMessage.event === "new_event") {
    // 处理新事件
}
```

### 调试

- **前端日志**：使用 `@tauri-apps/plugin-log` 进行日志记录
- **后端日志**：使用 `log` crate，日志级别在 `lib.rs` 中配置
- **WebSocket 调试**：使用浏览器开发者工具的网络标签页

### 代码规范

- **Rust**: 遵循 Rust 官方代码规范，使用 `rustfmt` 格式化
- **TypeScript**: 使用 ESLint 和 Prettier 进行代码检查和格式化
- **提交信息**: 使用约定式提交格式（Conventional Commits）

## ? 协议说明

### BC 设备消息协议

#### 消息格式

```
[起始标志 0x1E][长度(2字节)][消息ID(2字节)][会话ID(1字节)]
[源ID(1字节)][目标ID(1字节)][时间戳秒(4字节)][时间戳微秒(4字节)]
[序列号(2字节)][载荷...][结束标志 0xE1]
```

#### 字节序

- 所有多字节字段使用 **小端字节序（Little Endian）**

#### 消息头结构

| 字段 | 类型 | 说明 |
|------|------|------|
| sof | u8 | 起始标志 (0x1E) |
| len | u16 | 消息总长度 |
| msg_id | u16 | 消息ID |
| ses_id | u8 | 会话ID |
| src_id | u8 | 源节点ID |
| tgt_id | u8 | 目标节点ID |
| ts_sec | u32 | Unix 时间戳（秒） |
| ts_us | u32 | Unix 时间戳（微秒） |
| seq_num | u16 | 序列号 |

### 支持的消息类型

- `MSG_SCM_MCM_AXIS_DATAOUTPUT_SET` (0x1020)
- `MSG_SCM_MCM_MOUNT_SET` (0x1021)
- `MSG_SCM_MCM_INIT_REQ` (0x1023)
- `MSG_SCM_MCM_SURGERY_SET` (0x1029)
- `MSG_SCM_MCM_BU_SET` (0x102F)
- `MSG_MCM_STATUS_NOTIFY` (0x1200)
- `MSG_MC_STATUS_REQ` (0x1240)
- `MSG_MC_STATUS_RSP` (0x1241)
- `MSG_MC_KSYNC_CTRL_REQ` (0x1246)
- `MSG_MC_KSYNC_CTRL_RSP` (0x1247)
- `MSG_MC_STATUS_NTF` (0x1248)
- `MSG_MC_MOTION_CTRL_REQ` (0x1249)
- `MSG_MC_MOTION_CTRL_RSP` (0x124A)
- `MSG_MC_MOUNT_CTRL_REQ` (0x124B)
- `MSG_MC_MOUNT_CTRL_RSP` (0x124C)
- `MSG_MC_DEV_CTRL_REQ` (0x124D)
- `MSG_MC_DEV_CTRL_RSP` (0x124E)

## ? 常见问题

### WebSocket 连接失败

**问题**: 前端无法连接到 WebSocket 服务器

**解决方案**:
1. 确认后端已成功启动（查看控制台日志）
2. 检查端口 8080 是否被占用
3. 确认防火墙未阻止连接

### BC 设备连接失败

**问题**: 无法连接到 BC 设备

**解决方案**:
1. 检查 IP 地址和端口是否正确
2. 确认 BC 设备正在运行并监听指定端口
3. 检查网络连接
4. 查看后端日志获取详细错误信息

### 消息显示异常

**问题**: 消息格式不正确或显示乱码

**解决方案**:
1. 检查消息协议是否匹配
2. 确认字节序设置正确（小端）
3. 查看日志中的原始消息数据

### 性能问题

**问题**: 消息接收速度慢或界面卡顿

**解决方案**:
1. 使用消息过滤减少显示的消息数量
2. 限制消息历史记录数量（当前限制为 1000 条）
3. 检查系统资源使用情况

## ? 许可证

本项目采用 MIT 许可证。

## ? 贡献

欢迎提交 Issue 和 Pull Request！

## ? 相关文档

- [Tauri 文档](https://tauri.app/)
- [React 文档](https://react.dev/)
- [Material-UI 文档](https://mui.com/)
- [Tokio 文档](https://tokio.rs/)

---

**注意**: 本项目仍在积极开发中，API 可能会发生变化。
