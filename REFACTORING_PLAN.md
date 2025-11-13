# App.tsx 重构计划

## ? 当前问题分析

### 1. 代码结构问题
- **单一文件过大**：963行代码全部在一个文件中
- **职责不清**：组件、工具函数、类型定义、常量混在一起
- **耦合度高**：Toolbar 组件包含 WebSocket 连接逻辑、状态管理、UI 渲染

### 2. 命名规范问题
- `FilterFunc` 应该使用更清晰的命名（如 `filterMessage`）
- `configPanelVisible` 函数名与变量名冲突
- 使用 `==` 而非 `===` 进行相等比较

### 3. 代码组织问题
- 工具函数（验证函数）应该独立
- 类型定义应该集中管理
- 常量（columns、默认值）应该提取
- WebSocket 逻辑应该提取为自定义 Hook

### 4. React 最佳实践问题
- WebSocket 连接逻辑应该使用自定义 Hook
- 状态管理可以进一步优化
- 组件应该更小、更专注

---

## ? 重构目标

### 高内聚
- 每个模块/组件只负责一个明确的功能
- 相关代码组织在一起

### 低耦合
- 组件之间通过明确的接口通信
- 业务逻辑与 UI 分离
- 可复用的逻辑提取为 Hooks 或工具函数

### 规范化
- 遵循 React/TypeScript 社区最佳实践
- 统一的命名规范
- 清晰的代码组织结构

---

## ? 目标文件结构

```
src/
├── types/
│   └── index.ts              # 所有类型定义
├── utils/
│   ├── validation.ts         # 验证函数
│   └── messageTree.ts       # 消息树构建
├── constants/
│   └── index.ts              # 常量定义（columns, 默认值等）
├── hooks/
│   ├── useWebSocket.ts       # WebSocket 连接 Hook
│   ├── useMessageFilter.ts   # 消息过滤 Hook
│   └── useConsoleForward.ts # Console 转发 Hook
├── components/
│   ├── IpAddressInput/
│   │   └── index.tsx
│   ├── Toolbar/
│   │   └── index.tsx
│   ├── ConfigPanel/
│   │   └── index.tsx
│   ├── MessageGrid/
│   │   └── index.tsx
│   ├── MessageTreeView/
│   │   └── index.tsx
│   ├── ConnectionStatusChip/
│   │   └── index.tsx
│   └── EmptyState/
│       └── index.tsx
└── App.tsx                    # 主应用组件（简化后）
```

---

## ? 重构步骤

### 步骤 1: 提取类型定义
- 创建 `src/types/index.ts`
- 移动所有 interface、enum 定义

### 步骤 2: 提取工具函数
- 创建 `src/utils/validation.ts` - IP/Port 验证
- 创建 `src/utils/messageTree.ts` - 树构建逻辑

### 步骤 3: 提取常量
- 创建 `src/constants/index.ts`
- 移动 columns 定义、默认值等

### 步骤 4: 创建自定义 Hooks
- `useWebSocket.ts` - WebSocket 连接管理
- `useMessageFilter.ts` - 消息过滤逻辑
- `useConsoleForward.ts` - Console 转发

### 步骤 5: 拆分组件
- 每个组件独立文件
- 组件只负责 UI 渲染
- 业务逻辑通过 props 或 Hooks 传入

### 步骤 6: 重构主 App 组件
- 简化 App.tsx
- 只保留布局和组件组合逻辑

---

## ? 命名规范

### 组件命名
- 使用 PascalCase：`IpAddressInput`, `MessageGrid`
- 文件名与组件名一致

### 函数命名
- 使用 camelCase：`handleIpChange`, `filterMessage`
- 事件处理函数以 `handle` 开头
- 工具函数使用动词：`validateIpAddress`, `buildMessageTree`

### 变量命名
- 使用 camelCase：`connectionStatus`, `selectedRowId`
- 布尔值使用 `is`/`has` 前缀：`isVisible`, `hasError`

### 类型命名
- Interface 使用 PascalCase：`MessageReport`, `ToolbarProps`
- Enum 使用 PascalCase：`FilterType`

### 常量命名
- 使用 UPPER_SNAKE_CASE：`DEFAULT_PAGE_SIZE`, `MAX_MESSAGES`
- 或使用 camelCase（如果只是配置对象）

---

## ? 重构检查清单

- [ ] 类型定义提取到 types/
- [ ] 工具函数提取到 utils/
- [ ] 常量提取到 constants/
- [ ] 自定义 Hooks 创建
- [ ] 组件拆分到独立文件
- [ ] 命名规范化
- [ ] 使用 `===` 替代 `==`
- [ ] 移除未使用的导入
- [ ] 添加必要的注释
- [ ] 保持功能完全一致

