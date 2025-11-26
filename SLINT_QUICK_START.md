# Slint 快速开始指南

本文档提供将项目迁移到 Slint 的快速开始步骤和示例代码。

## 🚀 第一步：添加依赖

### 1. 更新 Cargo.toml

在 `src-tauri/Cargo.toml` 中添加 Slint 依赖：

```toml
[dependencies]
# ... 现有依赖保持不变 ...

# Slint UI 框架
slint = { version = "1.8", features = ["backend-qt"] }

# 或者使用 winit 后端（纯 Rust，无需 Qt）
# slint = { version = "1.8", features = ["backend-winit"] }
```

### 2. 更新 build.rs

修改 `src-tauri/build.rs`：

```rust
fn main() {
    tauri_build::build();
    
    // 编译 Slint UI 文件
    slint_build::compile("ui/main_window.slint").unwrap();
}
```

并在 `[build-dependencies]` 中添加：

```toml
[build-dependencies]
tauri-build = { version = "2", features = [] }
slint-build = "1.8"
```

## 📁 第二步：创建 UI 目录和文件

### 1. 创建目录

```bash
mkdir -p src-tauri/src/ui
```

### 2. 创建主窗口 UI 文件

创建 `src-tauri/src/ui/main_window.slint`：

```slint
export component MainWindow {
    // 状态属性
    in-out property <string> title: "Message Viewer";
    in-out property <int> message-count: 0;
    
    // 回调函数
    callback button-clicked();
    
    Window {
        title: root.title;
        width: 800px;
        height: 600px;
        
        VerticalBox {
            alignment: center;
            spacing: 20px;
            
            Text {
                text: "Welcome to Slint!";
                font-size: 24px;
                color: #333333;
            }
            
            Text {
                text: "Message count: " + root.message-count;
                font-size: 18px;
                color: #666666;
            }
            
            Button {
                text: "Click Me";
                clicked => {
                    root.button-clicked();
                }
            }
        }
    }
}
```

## 🔧 第三步：修改 Rust 代码

### 1. 修改 src/main.rs

```rust
// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// 包含 Slint UI 模块
slint::include_modules!();

fn main() -> Result<(), slint::PlatformError> {
    // 创建 UI 窗口
    let ui = MainWindow::new()?;
    
    // 设置初始值
    ui.set_title(slint::SharedString::from("Message Viewer - Slint"));
    ui.set_message_count(0);
    
    // 处理按钮点击事件
    let ui_handle = ui.as_weak();
    ui.on_button_clicked(move || {
        let ui = ui_handle.unwrap();
        let current_count = ui.get_message_count();
        ui.set_message_count(current_count + 1);
        println!("Button clicked! Count: {}", current_count + 1);
    });
    
    // 运行 UI
    ui.run()
}
```

### 2. 如果使用 Tauri，修改 src-tauri/src/lib.rs

```rust
use slint::SharedString;

// 包含 Slint UI 模块
slint::include_modules!();

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 创建 Slint UI
    let ui = MainWindow::new().unwrap();
    
    // 设置初始状态
    ui.set_title(SharedString::from("Message Viewer"));
    ui.set_message_count(0);
    
    // 处理事件
    let ui_handle = ui.as_weak();
    ui.on_button_clicked(move || {
        let ui = ui_handle.unwrap();
        let count = ui.get_message_count();
        ui.set_message_count(count + 1);
    });
    
    // 在后台运行 Slint UI
    let ui_handle2 = ui.as_weak();
    std::thread::spawn(move || {
        ui_handle2.unwrap().run().unwrap();
    });
    
    // 启动 Tauri
    tauri::Builder::default()
        .setup(|app| {
            // Tauri 初始化代码
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 🎨 第四步：创建消息表格组件示例

创建 `src-tauri/src/ui/message_grid.slint`：

```slint
import { MessageReport } from "main_window.slint";

export component MessageGrid {
    in property <[MessageReport]> reports: [];
    in property <int> selected-row-id: -1;
    callback row-selected(int);
    
    Rectangle {
        background: #ffffff;
        border-width: 1px;
        border-color: #e0e0e0;
        border-radius: 4px;
        
        VerticalBox {
            // 表头
            HorizontalBox {
                height: 40px;
                background: #f5f5f5;
                border-bottom-width: 1px;
                border-bottom-color: #e0e0e0;
                
                Text {
                    text: "时间";
                    width: 20%;
                    font-weight: 700;
                }
                Text {
                    text: "消息ID";
                    width: 15%;
                    font-weight: 700;
                }
                Text {
                    text: "发送者";
                    width: 15%;
                    font-weight: 700;
                }
                Text {
                    text: "接收者";
                    width: 15%;
                    font-weight: 700;
                }
                Text {
                    text: "载荷";
                    width: 35%;
                    font-weight: 700;
                }
            }
            
            // 表格内容
            ListView {
                for report[index] in reports: MessageRow {
                    height: 40px;
                    selected: index == selected-row-id;
                    report: report;
                    clicked => { row-selected(index) }
                }
            }
        }
    }
}

component MessageRow {
    in property <MessageReport> report;
    in property <bool> selected;
    callback clicked <=> touch.clicked;
    
    Rectangle {
        background: selected ? #e3f2fd : #ffffff;
        border-bottom-width: 1px;
        border-bottom-color: #f0f0f0;
        
        HorizontalBox {
            padding: 8px;
            
            Text {
                text: report.datetime;
                width: 20%;
                font-size: 12px;
            }
            Text {
                text: report.message-id;
                width: 15%;
                font-size: 12px;
            }
            Text {
                text: report.sender;
                width: 15%;
                font-size: 12px;
            }
            Text {
                text: report.receiver;
                width: 15%;
                font-size: 12px;
            }
            Text {
                text: report.payload;
                width: 35%;
                font-size: 12px;
                elide: elide-right;
            }
        }
    }
}
```

更新 `main_window.slint` 以包含消息表格：

```slint
import { MessageGrid } from "message_grid.slint";

export struct MessageReport {
    datetime: string,
    sender: string,
    receiver: string,
    message-id: string,
    payload: string,
}

export component MainWindow {
    in-out property <[MessageReport]> reports: [];
    in-out property <int> selected-row-id: -1;
    callback row-selected(int);
    
    Window {
        title: "Message Viewer";
        width: 1200px;
        height: 800px;
        
        VerticalBox {
            padding: 16px;
            spacing: 16px;
            
            // 工具栏区域
            Rectangle {
                height: 60px;
                background: #f5f5f5;
                border-radius: 4px;
                
                HorizontalBox {
                    alignment: center;
                    spacing: 16px;
                    padding: 8px;
                    
                    Button {
                        text: "Start";
                    }
                    
                    Button {
                        text: "Stop";
                    }
                    
                    Text {
                        text: "Status: Connected";
                        color: #4caf50;
                    }
                }
            }
            
            // 消息表格
            MessageGrid {
                reports: root.reports;
                selected-row-id: root.selected-row-id;
                row-selected => { |id| root.row-selected(id) }
            }
        }
    }
}
```

## 🔌 第五步：集成 WebSocket 和状态管理

在 Rust 中集成现有的 WebSocket 逻辑：

```rust
use slint::SharedString;
use std::sync::{Arc, Mutex};
use msgviewer_lib::models::MessageReport;

slint::include_modules!();

fn main() -> Result<(), slint::PlatformError> {
    let ui = MainWindow::new()?;
    
    // 共享状态
    let reports: Arc<Mutex<Vec<slint::ModelRc<MessageReport>>>> = Arc::new(Mutex::new(Default::default()));
    
    // 处理行选择
    let ui_handle = ui.as_weak();
    ui.on_row_selected(move |id| {
        let ui = ui_handle.unwrap();
        ui.set_selected_row_id(id);
    });
    
    // 启动 WebSocket 服务器
    let ui_handle2 = ui.as_weak();
    let reports_clone = reports.clone();
    
    tokio::spawn(async move {
        // 使用现有的 WebSocket 服务器代码
        // 当收到消息时，更新 UI
        let handler = Box::new(move |report: MessageReport| {
            let ui = ui_handle2.unwrap();
            let mut reports = reports_clone.lock().unwrap();
            
            // 转换为 Slint 的 MessageReport
            let slint_report = MessageReport {
                datetime: SharedString::from(report.datetime.to_string()),
                sender: SharedString::from(report.sender.clone()),
                receiver: SharedString::from(report.receiver.clone()),
                message_id: SharedString::from(report.message_id.clone()),
                payload: SharedString::from(report.payload.clone()),
            };
            
            // 添加到列表
            // 注意：需要实现适当的列表更新逻辑
            // reports.push(slint::ModelRc::new(slint_report));
            
            // 更新 UI
            // ui.set_reports(...);
        });
        
        // WebSocketServer::start(handler).await;
    });
    
    ui.run()
}
```

## 📝 数据模型转换

需要在 Rust 中定义 Slint 的数据结构：

```rust
// 在 Slint UI 文件中定义
// ui/main_window.slint
export struct MessageReport {
    datetime: string,
    sender: string,
    receiver: string,
    message-id: string,
    payload: string,
}

// 在 Rust 中转换
fn convert_to_slint_report(report: &msgviewer_lib::models::MessageReport) -> MessageReport {
    MessageReport {
        datetime: SharedString::from(report.datetime.to_string()),
        sender: SharedString::from(report.sender.clone()),
        receiver: SharedString::from(report.receiver.clone()),
        message_id: SharedString::from(report.message_id.clone()),
        payload: SharedString::from(report.payload.clone()),
    }
}
```

## 🧪 测试运行

### 1. 编译项目

```bash
cd src-tauri
cargo build
```

### 2. 运行应用

```bash
cargo run
```

### 3. 如果遇到编译错误

- 确保 Slint 版本正确
- 检查 UI 文件路径是否正确
- 确保所有依赖都已安装

## 🎯 下一步

1. 逐步迁移各个组件
2. 实现消息过滤功能
3. 实现消息树形视图
4. 优化 UI 样式和布局
5. 测试所有功能

## 📚 参考

- [Slint 文档](https://slint-ui.com/docs/)
- [Slint 示例](https://github.com/slint-ui/slint/tree/master/examples)
- [Slint Rust API](https://docs.rs/slint/)

