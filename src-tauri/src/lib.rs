// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

// External crates
use std::sync::RwLock;

use tauri::WindowEvent;

// Internal modules
pub mod models;
pub mod utils;
pub mod websocket;
pub mod bc_comm;
pub mod app_state;

use models::{MsgHeader, MessageReport};
use websocket::WebSocketServer;
use app_state::{APP_HANDLE, set_ws_running, set_bc_comm_running};

// Constants
const MAX_MESSAGE_LEN: usize = 2000;
const MSG_HEADER_LEN: usize = std::mem::size_of::<MsgHeader>();

const MSG_SCM_MCM_AXIS_DATAOUTPUT_SET: u16 = 0x1020;
const MSG_SCM_MCM_MOUNT_SET: u16 = 0x1021;
const MSG_SCM_MCM_INIT_REQ: u16 = 0x1023;
const MSG_SCM_MCM_SURGERY_SET: u16 = 0x1029;
const MSG_SCM_MCM_BU_SET: u16 = 0x102F;
const MSG_MCM_STATUS_NOTIFY: u16 = 0x1200;

const MSG_MC_STATUS_REQ: u16 = 0x1240;
const MSG_MC_STATUS_RSP: u16 = 0x1241;
const MSG_MC_KSYNC_CTRL_REQ: u16 = 0x1246;
const MSG_MC_KSYNC_CTRL_RSP: u16 = 0x1247;
const MSG_MC_STATUS_NTF: u16 = 0x1248;
const MSG_MC_MOTION_CTRL_REQ: u16 = 0x1249;
const MSG_MC_MOTION_CTRL_RSP: u16 = 0x124A;
const MSG_MC_MOUNT_CTRL_REQ: u16 = 0x124B;
const MSG_MC_MOUNT_CTRL_RSP: u16 = 0x124C;
const MSG_MC_DEV_CTRL_REQ: u16 = 0x124D;
const MSG_MC_DEV_CTRL_RSP: u16 = 0x124E;

const US_PER_SEC: u64 = 1000000;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize the WebSocket server when the application starts
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            APP_HANDLE.get_or_init(|| RwLock::new(Some(handle.clone())));

            tauri::async_runtime::spawn({
                async move {
                    let handler = Box::new(|report: MessageReport| {
                        // For now, we'll just log that we received a message
                        log::info!("Received message: {:?}", report);
                    });
                    WebSocketServer::start(handler).await;
                }
            });

            Ok(())
        })
        .on_window_event(|_window, event| {
            if let WindowEvent::CloseRequested { .. } = event {
                log::info!("Received window close request; stopping WebSocket and communication tasks.");
                set_ws_running(false);
                set_bc_comm_running(false);
            }
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // Remove the start_websocket command since we're starting it automatically
        .invoke_handler(tauri::generate_handler![])
        .run(tauri::generate_context!())
        .map_err(|err| {
            eprintln!("Error while running Tauri application: {}", err);
            // Set WebSocket server to stop when application exits
            set_ws_running(false);
            set_bc_comm_running(false);
            err
        })
        .expect("error while running tauri application");
}