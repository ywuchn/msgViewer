//! Application state management

use std::sync::RwLock;
use once_cell::sync::OnceCell;
use tauri::AppHandle;
use lazy_static::lazy_static;

// Application handle
pub static APP_HANDLE: OnceCell<RwLock<Option<AppHandle>>> = OnceCell::new();

// Global state flags
lazy_static! {
    pub static ref BC_RUNNING: std::sync::Mutex<bool> = std::sync::Mutex::new(false);
    pub static ref WS_RUNNING: std::sync::Mutex<bool> = std::sync::Mutex::new(false);
}

/// Get application handle
pub fn get_app_handle() -> Option<AppHandle> {
    APP_HANDLE
        .get()
        .and_then(|handle_lock| handle_lock.read().ok())
        .and_then(|guard| guard.clone())
}

/// Get WebSocket running status
pub fn get_ws_running() -> bool {
    if let Ok(running) = WS_RUNNING.lock() {
        return *running;
    } else {
        return false;
    }
}

/// Set WebSocket running status
pub fn set_ws_running(val: bool) {
    if let Ok(mut running) = WS_RUNNING.lock() {
        *running = val;
    }
}

/// Get BC communication running status
pub fn get_dev_comm_running() -> bool {
    if let Ok(running) = BC_RUNNING.lock() {
        return *running;
    } else {
        return false;
    }
}

/// Set BC communication running status
pub fn set_bc_comm_running(val: bool) {
    if let Ok(mut running) = BC_RUNNING.lock() {
        *running = val;
    }
}