// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use tauri::{AppHandle, Emitter};

use std::io::prelude::*;

use std::collections::HashMap;

use lazy_static::lazy_static;
use once_cell::sync::OnceCell;
use parking_lot::RwLock;
use std::sync::Arc;
use tokio::sync::Mutex;

use tokio::io::{AsyncReadExt, AsyncWriteExt};

use bytemuck::{Pod, Zeroable};
use chrono::{DateTime, Utc};
use futures_util::stream::{SplitSink, StreamExt};
use futures_util::SinkExt;
use tokio_tungstenite::tungstenite::protocol::Message;
use tokio_tungstenite::WebSocketStream;

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

#[derive(Debug, Copy, Clone, Pod, Zeroable)]
#[repr(C, packed)]
struct MsgHeader {
    sof: u8,
    len: u16,
    msg_id: u16, // message id
    ses_id: u8,  // session id
    src_id: u8,  // source
    tgt_id: u8,  // target
    ts_sec: u32, // second from 1970/1/1
    ts_us: u32,  // us portion
    seq_num: u16,
}

#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageReport {
    pub datetime: String,
    pub sender: String,
    pub receiver: String,
    pub message_id: String,
    pub payload: String,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct FrontEndCommand {
    command: String,
    content: String,
}

enum SockErrCode {
    SockDisconnected,
    SockError,
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

static APP_HANDLE: OnceCell<RwLock<Option<AppHandle>>> = OnceCell::new();

lazy_static! {
    static ref BC_RUNNING: std::sync::Mutex<bool> = std::sync::Mutex::new(false);
    static ref WS_RUNNING: std::sync::Mutex<bool> = std::sync::Mutex::new(false);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

const MAX_MESSAGE_LEN: usize = 2000;
const MSG_HEADER_LEN: usize = std::mem::size_of::<MsgHeader>();
const MSG_CSUM_LEN: usize = 2;
const MSG_DLMT_LEN: usize = 1;
const MSG_NPLD_LEN: usize = MSG_HEADER_LEN + MSG_CSUM_LEN + MSG_DLMT_LEN;

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

fn get_app_handle() -> Option<AppHandle> {
    APP_HANDLE
        .get()
        .and_then(|handle_lock| handle_lock.read().clone())
}

fn get_ws_running() -> bool {
    if let Ok(running) = WS_RUNNING.lock() {
        return *running;
    } else {
        return false;
    }
}

fn set_ws_running(val: bool) {
    if let Ok(mut running) = WS_RUNNING.lock() {
        *running = val;
    }
}

fn get_bc_comm_running() -> bool {
    if let Ok(running) = BC_RUNNING.lock() {
        return *running;
    } else {
        return false;
    }
}

fn set_bc_comm_running(val: bool) {
    if let Ok(mut running) = BC_RUNNING.lock() {
        *running = val;
    }
}

fn get_node_name(node_id: u8) -> String {
    format!("{:02X}", node_id)
}

// Define a macro to automatically generate the content of msg_tbl
macro_rules! generate_msg_map {
    ($($key:expr => $value:expr),* $(,)?) => {{
        let mut map = HashMap::new();
        $(
            map.insert($key, $value);
        )*
        map
    }};
}

fn get_msg_name(msg_id: u16) -> String {
    // Use HashMap to store the mapping of message ID and name
    let msg_tbl = generate_msg_map![
        MSG_SCM_MCM_AXIS_DATAOUTPUT_SET => "MSG_SCM_MCM_AXIS_DATAOUTPUT_SET",
        MSG_SCM_MCM_MOUNT_SET => "MSG_SCM_MCM_MOUNT_SET",
        MSG_SCM_MCM_INIT_REQ => "MSG_SCM_MCM_INIT_REQ",
        MSG_SCM_MCM_SURGERY_SET => "MSG_SCM_MCM_SURGERY_SET",
        MSG_SCM_MCM_BU_SET => "MSG_SCM_MCM_BU_SET",
        MSG_MC_MOTION_CTRL_REQ => "MSG_MC_MOTION_CTRL_REQ",
        MSG_MC_MOTION_CTRL_RSP => "MSG_MC_MOTION_CTRL_RSP",
        MSG_MC_MOUNT_CTRL_REQ => "MSG_MC_MOUNT_CTRL_REQ",
        MSG_MC_MOUNT_CTRL_RSP => "MSG_MC_MOUNT_CTRL_RSP",
        MSG_MC_DEV_CTRL_REQ => "MSG_MC_DEV_CTRL_REQ",
        MSG_MC_DEV_CTRL_RSP => "MSG_MC_DEV_CTRL_RSP",
        MSG_MCM_STATUS_NOTIFY => "MSG_MCM_STATUS_NOTIFY",
        MSG_MC_STATUS_REQ => "MSG_MC_STATUS_REQ",
        MSG_MC_STATUS_RSP => "MSG_MC_STATUS_RSP",
        MSG_MC_STATUS_NTF => "MSG_MC_STATUS_NTF",
        MSG_MC_KSYNC_CTRL_REQ => "MSG_MC_KSYNC_CTRL_REQ",
        MSG_MC_KSYNC_CTRL_RSP => "MSG_MC_KSYNC_CTRL_RSP",
    ];

    // Look up the name corresponding to msg_id
    if let Some(name) = msg_tbl.get(&msg_id) {
        return name.to_string();
    }

    // If not found, return the formatted hexadecimal string
    format!("{:04X}", msg_id)
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

async fn handle_message<F>(msg: Vec<u8>, message_handler: F) 
where 
    F: FnOnce(MessageReport),
{
    if msg.len() < MSG_HEADER_LEN {
        log::warn!(
            "Message too short to contain a valid header, length: {}",
            msg.len()
        );
        return;
    }

    // Use bytemuck to parse the message header
    if let Some(header) = bytemuck::cast_slice::<u8, MsgHeader>(&msg[..MSG_HEADER_LEN]).first() {
        // Verify the start flag
        if header.sof != 0x1E {
            log::warn!("Invalid start flag: {:02X}", header.sof);
            return;
        }

        // Fix packed struct alignment issue
        let ts_sec = u32::from_le(header.ts_sec); // or u32::from_be, depending on byte order
        let ts_us = u32::from_le(header.ts_us);   // or u32::from_be, depending on byte order
        let ts = ts_sec as u64 * US_PER_SEC + ts_us as u64;
        let dt = match std::time::UNIX_EPOCH.checked_add(std::time::Duration::from_micros(ts)) {
            Some(duration) => DateTime::<Utc>::from(duration),
            None => {
                log::warn!("Invalid timestamp: {} seconds, {} microseconds", ts_sec, ts_us);
                return;
            }
        };

        let sender = get_node_name(header.src_id);
        let receiver = get_node_name(header.tgt_id);
        let message_id = get_msg_name(header.msg_id);

        // Optimize payload processing: use pre-allocated String and write! macro
        let payload = {
            let mut result = String::with_capacity(msg.len() * 3); // Estimate capacity
            for (i, byte) in msg[MSG_HEADER_LEN..].iter().enumerate() {
                if i > 0 {
                    result.push(' ');
                }
                use std::fmt::Write;
                write!(result, "{:02X}", byte).unwrap(); // Use write! macro for better efficiency
            }
            result
        };

        let msg_report = MessageReport {
            datetime: dt.format("%Y-%m-%d %H:%M:%S:%3f").to_string(),
            sender,
            receiver,
            message_id,
            payload,
        };

        // log::info!(
        //     "[{}][{}]: {} -> {} : {}",
        //     msg_report.datetime,
        //     msg_report.message_id,
        //     msg_report.sender,
        //     msg_report.receiver,
        //     msg_report.payload
        // );

        message_handler(msg_report);
    } else {
        log::error!("Failed to extract message header");
    }
}

async fn read_data(stream: &mut tokio::net::TcpStream, len: usize) -> Result<Vec<u8>, SockErrCode> {
    // Boundary condition optimization: if len is 0, return empty Vec directly
    if len == 0 {
        return Ok(Vec::new());
    }

    let mut buf = vec![0; len]; // Pre-allocate buffer

    match stream.read_exact(&mut buf).await {
        Ok(_) => {
            // log::info!("Read {} bytes", len);
            Ok(buf)
        }
        Err(e) => {
            if e.kind() == std::io::ErrorKind::UnexpectedEof {
                log::error!("Connection closed by peer");
                Err(SockErrCode::SockDisconnected)
            } else {
                log::error!("Read failed: {}", e);
                Err(SockErrCode::SockError)
            }
        }
    }
}
// Helper function to locate the start flag in a slice.
fn find_start_flag(slice: &[u8], flag: u8) -> Option<usize> {
    slice.iter().position(|&ch| ch == flag)
}

async fn read_packet(stream: &mut tokio::net::TcpStream) -> Result<Vec<u8>, SockErrCode> {
    const START_FLAG: u8 = 0x1E;
    const END_FLAG: u8 = 0xE1;
    let mut start_pos: usize = 0;
    let mut read_pos: usize = 0;
    let mut message_buf = [0; MAX_MESSAGE_LEN * 2];
    let mut msg_len: usize = 0;

    // Read Header
    while read_pos < MSG_HEADER_LEN {
        let read_buf = message_buf[start_pos + read_pos..start_pos + MSG_HEADER_LEN].as_mut();

        match read_data(stream, MSG_HEADER_LEN - read_pos).await {
            Ok(data) => {
                read_buf.copy_from_slice(&data);
            }
            Err(e) => {
                return Err(e);
            }
        }

        // locate start flag.
        if let Some(pos) = find_start_flag(
            &message_buf[start_pos..start_pos + MSG_HEADER_LEN],
            START_FLAG,
        ) {
            if pos == 0 {
                if let Some(header) = bytemuck::cast_slice::<u8, MsgHeader>(
                    &message_buf[start_pos..start_pos + MSG_HEADER_LEN],
                )
                .first()
                {
                    // check message header.
                    if header.len as usize >= MSG_NPLD_LEN && header.len as usize <= MAX_MESSAGE_LEN
                    {
                        msg_len = header.len as usize;
                        break;
                    } else {
                        // log::warn!("Invalid message length: {}", header.len);
                        return Err(SockErrCode::SockError); // InvalidMessageLength
                    }
                } else {
                    log::warn!("Failed to parse message header");
                    return Err(SockErrCode::SockError);
                }
            } else {
                start_pos += pos;
                read_pos = MSG_HEADER_LEN - pos;
                if start_pos >= MSG_HEADER_LEN * 2 {
                    message_buf.copy_within(start_pos..start_pos + read_pos, 0);
                    start_pos = 0;
                }
                continue;
            }
        } else {
            // no start flag found, discard all data and star from 0.
            start_pos = 0;
            read_pos = 0;
            continue;
        }
    }
    if start_pos > 0 {
        message_buf.copy_within(start_pos..start_pos + read_pos, 0);
        start_pos = 0;
    }

    // read payload
    match read_data(stream, msg_len - MSG_HEADER_LEN).await {
        Ok(data) => {
            message_buf[MSG_HEADER_LEN..msg_len].copy_from_slice(&data);
        }
        Err(e) => {
            return Err(e);
        }
    }

    if message_buf[msg_len - 1] != END_FLAG {
        log::warn!("invalid end flag");
        // return Err(SockErrCode::InvalidEndFlag);
    }

    Ok(message_buf[..msg_len].to_vec())
}

async fn start_comm_with_bc(
    sink: Arc<Mutex<SplitSink<WebSocketStream<tokio::net::TcpStream>, Message>>>,
    addr: String,
) {
    tokio::spawn(async move {
        log::info!("start bc communication with {}", addr);

        let (tx, mut rx) = tokio::sync::mpsc::channel::<MessageReport>(100);
        let sink_for_bc = Arc::clone(&sink);
        let sink_for_ws = Arc::clone(&sink);

        // Communication with bc.
        let bc_handle = tokio::spawn(async move {
            loop {
                match tokio::time::timeout(
                    tokio::time::Duration::from_millis(500),
                    tokio::net::TcpStream::connect(addr.clone()),
                )
                .await
                {
                    Ok(Ok(mut stream)) => {
                        log::info!("Connected to bc");
                        // Send bc_monitor_started event via WebSocket
                        if let Ok(msg) = serde_json::to_string(&serde_json::json!({
                            "event": "bc_monitor_started",
                            "data": { "address": addr.clone() }
                        })) {
                            if let Err(e) = sink_for_bc.lock().await.send(Message::Text(msg)).await {
                                log::error!("Failed to send 'bc_monitor_started' via WebSocket: {}", e);
                            }
                        }

                        loop {
                            match read_packet(&mut stream).await {
                                Ok(msg) => {
                                    // log::info!("Recv message{:?}.", msg);
                                    let tx_cloned = tx.clone();
                                    let msg_handler = move |msg_report: MessageReport| {
                                        // Spawn a task to send the message report
                                        tokio::spawn(async move {
                                            if let Err(e) = tx_cloned.send(msg_report).await {
                                                log::error!("Failed to send message report: {}", e);
                                            }
                                        });
                                    };
                                    handle_message(msg, msg_handler).await;
                                }
                                Err(e) => match e {
                                    SockErrCode::SockDisconnected => {
                                        log::error!("SockDisconnected");
                                        if let Err(e) = stream.shutdown().await {
                                            log::error!("Failed to shutdown stream: {}", e);
                                        }
                                        break;
                                    }
                                    SockErrCode::SockError => {
                                        log::error!("SockError");
                                    }
                                },
                            }
                            if !get_bc_comm_running() {
                                log::info!("Detected stop bc command.");
                                break;
                            }
                        }

                        log::info!("Disconnected to bc");
                        // Send bc_monitor_stopped event via WebSocket
                        if let Ok(msg) = serde_json::to_string(&serde_json::json!({
                            "event": "bc_monitor_stopped",
                            "data": { "address": addr.clone() }
                        })) {
                            if let Err(e) = sink_for_bc.lock().await.send(Message::Text(msg)).await {
                                log::error!("Failed to send 'bc_monitor_stopped' via WebSocket: {}", e);
                            }
                        }
                    }
                    Ok(Err(e)) => {
                        log::warn!("Failed to connect to {}: {}", addr, e);
                    }
                    Err(_) => {
                        log::warn!("Timeout connecting to {}", addr);
                        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
                    }
                }

                if !get_bc_comm_running() {
                    log::info!("Detected stop bc command.");
                    break;
                }
            }
        });

        let ws_reply_handle = tokio::spawn(async move {
            loop {
                match tokio::time::timeout(tokio::time::Duration::from_millis(500), rx.recv()).await
                {
                    Ok(Some(message)) => {
                        // Send message update event via WebSocket
                        if let Ok(msg) = serde_json::to_string(&serde_json::json!({
                            "event": "msg_updated",
                            "data": message
                        })) {
                            if let Err(e) = sink_for_ws.lock().await.send(Message::Text(msg)).await {
                                log::error!("Failed to send message via WebSocket: {}", e);
                            }
                        }
                    }
                    Ok(None) => {
                        log::info!("Channel closed.");
                        break;
                    }
                    Err(_) => {
                        // Timeout
                    }
                }
                if !get_ws_running() {
                    log::info!("Detected stop bc command.");
                    break;
                }
            }
        });

        if let Err(e) = bc_handle.await {
            log::error!("BC communication task failed: {}", e);
        }
        if let Err(e) = ws_reply_handle.await {
            log::error!("WebSocket reply task failed: {}", e);
        }
        log::info!("Communication with BC stopped.");
    });
}

async fn frontend_communication(stream: WebSocketStream<tokio::net::TcpStream>) {
    log::info!("New WebSocket connection");

    let (sink, mut stream) = stream.split();
    let sink = Arc::new(Mutex::new(sink));

    loop {
        match tokio::time::timeout(tokio::time::Duration::from_millis(500), stream.next()).await {
            Ok(Some(Ok(msg))) => {
                if let Ok(cmd) = serde_json::from_str::<FrontEndCommand>(&msg.to_string()) {
                    log::info!("Received frontend command: {}", cmd.command);

                    match cmd.command.as_str() {
                        "start_recv" => {
                            if get_bc_comm_running() {
                                log::info!("communication is running.");
                                continue;
                            }
                            set_bc_comm_running(true);

                            let sink = Arc::clone(&sink);
                            start_comm_with_bc(sink, cmd.content).await;
                        }
                        "stop_recv" => {
                            set_bc_comm_running(false);
                        }
                        _ => {
                            log::info!("Unknown command: {}", cmd.command);
                        }
                    }
                }
            }
            Ok(None) => {
                log::info!("WebSocket stream closed");
                return;
            }
            Ok(Some(Err(e))) => {
                log::warn!("Websocket read error: {}", e);
                // Remove commented out error handling code
            }
            Err(_) => {
                // Remove commented out heartbeat code
            }
        }
        if !get_ws_running() {
            log::info!("WebSocket is no longer running, exiting...");
            return;
        }
    }
}

async fn start_websocket_server(_msg_handler: Box<dyn Fn(MessageReport) + Send>) {
    if get_ws_running() {
        log::info!("WebSocket server is already running.");
        return;
    }
    set_ws_running(true);
    tokio::spawn(async move {
        let addr = "127.0.0.1:8080".to_string();
        let listener = match tokio::net::TcpListener::bind(addr.clone()).await {
            Ok(listener) => listener,
            Err(e) => {
                log::error!("Failed to bind WebSocket server to {}: {}", addr, e);
                set_ws_running(false);
                return;
            }
        };

        log::info!("Start WebSocket server and listening on ws://{}", addr);

        if let Some(handle) = get_app_handle() {
            if let Err(e) = handle.emit("ws_started", addr.clone()) {
                log::warn!("Failed to emit 'ws_started' event: {}", e);
            }
        }

        loop {
            if !get_ws_running() {
                log::info!("WebSocket server is shutting down.");
                break;
            }

            match tokio::time::timeout(tokio::time::Duration::from_millis(500), listener.accept())
                .await
            {
                Ok(Ok((stream, addr))) => {
                    log::info!("New connection from {}", addr);
                    match tokio::time::timeout(
                        tokio::time::Duration::from_millis(500),
                        tokio_tungstenite::accept_async(stream),
                    )
                    .await
                    {
                        Ok(Ok(ws_stream)) => {
                            tokio::spawn(async move {
                                frontend_communication(ws_stream).await;
                            });
                        }
                        Ok(Err(e)) => log::warn!("WebSocket handshake failed: {}", e),
                        Err(_) => log::debug!("WebSocket handshake timed out"),
                    }
                }
                Ok(Err(e)) => log::warn!("Error accepting connection: {}", e),
                Err(_) => log::debug!("Connection accept timed out"),
            }
        }
    });
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////

#[tauri::command]
async fn start_websocket(app_handle: AppHandle) -> Result<(), String> {
    log::info!("start_websocket");

    let handler = Box::new(move |report: MessageReport| {
        if let Err(err) = app_handle.emit("msg_updated", report) {
            log::error!("Failed to emit 'msg_updated' event: {}", err);
        }
    });
    start_websocket_server(handler).await;

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let handle = app.handle();
            APP_HANDLE.get_or_init(|| RwLock::new(Some(handle.clone())));
            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .build(),
        )
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![start_websocket])
        .run(tauri::generate_context!())
        .map_err(|err| {
            eprintln!("Error while running Tauri application: {}", err);
            err
        })
        .expect("error while running tauri application");
}
