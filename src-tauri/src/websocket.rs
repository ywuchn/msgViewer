//! WebSocket server and communication handling

use tokio_tungstenite::WebSocketStream;
use futures_util::stream::StreamExt;
use futures_util::sink::SinkExt;
use serde_json::json;
use tauri::Emitter;

use crate::{
    models::{MessageReport, FrontEndCommand},
    app_state::{get_app_handle, get_ws_running, set_ws_running, get_bc_comm_running, set_bc_comm_running},
    bc_comm::{handle_message, read_packet}
};

/// Handle frontend communication
pub async fn frontend_communication(stream: WebSocketStream<tokio::net::TcpStream>) {
    log::info!("New WebSocket connection");

    let (sink, mut stream) = stream.split();
    let sink = std::sync::Arc::new(tokio::sync::Mutex::new(sink));

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

                            let sink = std::sync::Arc::clone(&sink);
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

/// Start communication with BC device
pub async fn start_comm_with_bc(
    sink: std::sync::Arc<tokio::sync::Mutex<dyn futures_util::sink::Sink<tokio_tungstenite::tungstenite::Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin + Send + 'static>>,
    addr: String,
) {
    tokio::spawn(async move {
        log::info!("start bc communication with {}", addr);

        let (tx, mut rx) = tokio::sync::mpsc::channel::<MessageReport>(100);
        let sink_for_bc = std::sync::Arc::clone(&sink);
        let sink_for_ws = std::sync::Arc::clone(&sink);

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
                        if let Ok(msg) = serde_json::to_string(&json!({
                            "event": "bc_monitor_started",
                            "data": { "address": addr.clone() }
                        })) {
                            {
                                let mut guard = sink_for_bc.lock().await;
                                if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await {
                                    log::error!("Failed to send 'bc_monitor_started' via WebSocket: {}", e);
                                }
                            }
                        }

                        loop {
                            match read_packet(&mut stream).await {
                                Ok(message) => {
                                    // log::info!("Recv message with header: {:?}", message.header);
                                    let tx_cloned = tx.clone();
                                    let msg_handler = move |msg_report: MessageReport| {
                                        // Spawn a task to send the message report
                                        tokio::spawn(async move {
                                            if let Err(e) = tx_cloned.send(msg_report).await {
                                                log::error!("Failed to send message report: {}", e);
                                            }
                                        });
                                    };
                                    handle_message(message, msg_handler).await;
                                }
                                Err(e) => match e {
                                    crate::models::SockErrCode::SockDisconnected => {
                                        log::error!("SockDisconnected");
                                        // Remove stream shutdown since it's not available
                                        break;
                                    }
                                    crate::models::SockErrCode::SockError => {
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
                        if let Ok(msg) = serde_json::to_string(&json!({
                            "event": "bc_monitor_stopped",
                            "data": { "address": addr.clone() }
                        })) {
                            {
                                let mut guard = sink_for_bc.lock().await;
                                if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await {
                                    log::error!("Failed to send 'bc_monitor_stopped' via WebSocket: {}", e);
                                }
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
                        if let Ok(msg) = serde_json::to_string(&json!({
                            "event": "msg_updated",
                            "data": message
                        })) {
                            {
                                let mut guard = sink_for_ws.lock().await;
                                if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await {
                                    log::error!("Failed to send message via WebSocket: {}", e);
                                }
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

/// WebSocket server implementation
pub struct WebSocketServer;

impl WebSocketServer {
    /// Start the WebSocket server
    pub async fn start(_msg_handler: Box<dyn Fn(MessageReport) + Send>) {
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
}