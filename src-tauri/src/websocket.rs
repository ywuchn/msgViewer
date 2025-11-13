//! WebSocket server and communication handling

use tokio_tungstenite::WebSocketStream;
use futures_util::stream::StreamExt;
use futures_util::sink::SinkExt;
use serde_json::json;
use tauri::Emitter;

use crate::{
    models::{MessageReport, FrontEndCommand},
    app_state::{get_app_handle, get_ws_running, set_ws_running, get_bc_comm_running, set_bc_comm_running},
    bc_comm::{parse_message_to_report, read_packet},
    config::{DEFAULT_WEBSOCKET_ADDR, DEFAULT_CHANNEL_BUFFER_SIZE, DEFAULT_NETWORK_TIMEOUT_MS},
};

type WebSocketSink = dyn futures_util::sink::Sink<tokio_tungstenite::tungstenite::Message, Error = tokio_tungstenite::tungstenite::Error> + Unpin + Send + 'static;


/// Handle frontend communication
/// This function manages the WebSocket connection with the frontend:
/// 1. Splits the WebSocket stream into sink and stream components
/// 2. Listens for commands from the frontend in a non-blocking loop
/// 3. Processes commands such as "start_recv" and "stop_recv"
/// 4. Spawns BC communication tasks (non-blocking) to allow immediate response to stop commands
/// 
/// Note: The communication loop must remain non-blocking to ensure stop commands
/// can be processed immediately, even when BC communication is active.
/// 
/// Parameters:
/// - stream: WebSocket stream for communication with the frontend
pub async fn frontend_communication(stream: WebSocketStream<tokio::net::TcpStream>) {
    log::info!("New WebSocket connection");

    // Split the WebSocket stream into sink (for sending) and stream (for receiving)
    let (sink, mut stream) = stream.split();
    let sink = std::sync::Arc::new(tokio::sync::Mutex::new(sink));

    // Main communication loop
    loop {
        // Check if WebSocket should stop before attempting to read
        if !get_ws_running() {
            log::info!("WebSocket is no longer running, exiting...");
            set_bc_comm_running(false);
            return;
        }

        match tokio::time::timeout(
            tokio::time::Duration::from_millis(DEFAULT_NETWORK_TIMEOUT_MS),
            stream.next()
        ).await {
            // Received a message from the frontend
            Ok(Some(Ok(msg))) => {
                // Try to parse the message as a FrontEndCommand
                if let Ok(cmd) = serde_json::from_str::<FrontEndCommand>(&msg.to_string()) {
                    log::info!("Received frontend command: {}", cmd.command);

                    // Process different commands
                    match cmd.command.as_str() {
                        // Start receiving messages from BC device
                        "start_recv" => {
                            if get_bc_comm_running() {
                                log::info!("communication is running.");
                                // Send error message to frontend
                                if let Ok(error_msg) = serde_json::to_string(&json!({
                                    "event": "error",
                                    "data": { "message": "Communication is already running" }
                                })) {
                                    let mut guard = sink.lock().await;
                                    if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(error_msg)).await {
                                        log::error!("Failed to send error message: {}", e);
                                    }
                                }
                                continue;
                            }
                            set_bc_comm_running(true);

                            // Spawn the communication task instead of awaiting it
                            // This is necessary because start_comm_with_bc blocks until communication stops.
                            // By spawning it, the frontend_communication loop can continue processing
                            // commands (especially stop_recv) without being blocked.
                            let sink = std::sync::Arc::clone(&sink);
                            tokio::spawn(async move {
                                start_comm_with_bc(sink, cmd.content).await;
                                // Ensure state is reset when communication stops naturally
                                set_bc_comm_running(false);
                            });
                        }
                        // Stop receiving messages from BC device
                        "stop_recv" => {
                            set_bc_comm_running(false);
                            // Send confirmation to frontend
                            if let Ok(confirm_msg) = serde_json::to_string(&json!({
                                "event": "stopped",
                                "data": { "message": "Communication stopped" }
                            })) {
                                let mut guard = sink.lock().await;
                                if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(confirm_msg)).await {
                                    log::error!("Failed to send confirmation message: {}", e);
                                }
                            }
                        }
                        // Unknown command
                        _ => {
                            log::info!("Unknown command: {}", cmd.command);
                            // Send error message to frontend
                            if let Ok(error_msg) = serde_json::to_string(&json!({
                                "event": "error",
                                "data": { "message": format!("Unknown command: {}", cmd.command) }
                            })) {
                                let mut guard = sink.lock().await;
                                if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(error_msg)).await {
                                    log::error!("Failed to send error message: {}", e);
                                }
                            }
                        }
                    }
                } else {
                    log::warn!("Failed to parse frontend command");
                    // Send error message to frontend
                    if let Ok(error_msg) = serde_json::to_string(&json!({
                        "event": "error",
                        "data": { "message": "Failed to parse command" }
                    })) {
                        let mut guard = sink.lock().await;
                        if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(error_msg)).await {
                            log::error!("Failed to send error message: {}", e);
                        }
                    }
                }
            }
            // WebSocket stream closed
            Ok(None) => {
                log::info!("WebSocket stream closed");
                set_bc_comm_running(false);
                return;
            }
            // Error occurred while reading from WebSocket
            Ok(Some(Err(e))) => {
                // Check if this is a connection closed error (expected during shutdown)
                let error_str = e.to_string();
                if error_str.contains("WSAStartup") || 
                   error_str.contains("10093") ||
                   error_str.contains("Connection reset") ||
                   error_str.contains("Broken pipe") {
                    // These are expected errors when the connection is closing
                    log::debug!("WebSocket connection closed: {}", e);
                } else {
                    // Log unexpected errors as warnings
                    log::warn!("Websocket read error: {}", e);
                }
                set_bc_comm_running(false);
                return;
            }
            // Timeout occurred while waiting for a message
            Err(_) => {
                // Timeout - continue loop
            }
        }
    }
}

/// Start communication with BC device
/// This function initializes the communication with a BC device by:
/// 1. Creating a channel for message reports
/// 2. Spawning two parallel tasks:
///    - bc_communication_task: Handles communication with the BC device
///    - websocket_reply_task: Sends message reports to the frontend via WebSocket
/// 3. Blocking until both tasks complete (when get_bc_comm_running() becomes false or connection fails)
/// 
/// Note: This function blocks until communication stops. It should be called from within
/// a spawned task (e.g., tokio::spawn) to avoid blocking the caller.
/// 
/// Parameters:
/// - sink: WebSocket sink for sending events to the frontend
/// - addr: Address of the BC device to connect to
pub async fn start_comm_with_bc(
    sink: std::sync::Arc<tokio::sync::Mutex<WebSocketSink>>,
    addr: String,
) {
    // Create a channel for message reports with a buffer size defined in config
    let (tx, rx) = tokio::sync::mpsc::channel::<MessageReport>(DEFAULT_CHANNEL_BUFFER_SIZE);
    
    // Clone sinks for different tasks
    let sink_for_ws = std::sync::Arc::clone(&sink);
    let addr_clone = addr.clone();

    // Spawn task for BC communication
    let bc_handle = tokio::spawn(async move {
        bc_communication_task(tx, sink, addr_clone).await
    });

    // Spawn task for WebSocket reply
    let ws_reply_handle = tokio::spawn(async move {
        websocket_reply_task(sink_for_ws, rx).await
    });

    // Wait for both tasks to complete
    if let Err(e) = bc_handle.await {
        log::error!("BC communication task failed: {}", e);
    }
    if let Err(e) = ws_reply_handle.await {
        log::error!("WebSocket reply task failed: {}", e);
    }
    log::info!("Communication with BC stopped.");
}

/// Task for BC communication
/// This function handles the communication with the BC device:
/// 1. Establishes a TCP connection to the BC device
/// 2. Sends "bc_monitor_started" event when connection is established
/// 3. Continuously reads and processes messages from the BC device
/// 4. Sends "bc_monitor_stopped" event when connection is closed
/// 
/// Parameters:
/// - tx: Channel sender for passing MessageReport to the WebSocket reply task
/// - sink: WebSocket sink for sending events directly to the frontend
/// - addr: Address of the BC device to connect to
async fn bc_communication_task(
    tx: tokio::sync::mpsc::Sender<MessageReport>,
    sink: std::sync::Arc<tokio::sync::Mutex<WebSocketSink>>,
    addr: String,
) {
    // Main connection loop - attempts to reconnect if connection is lost
    loop {
        match tokio::time::timeout(
            tokio::time::Duration::from_millis(DEFAULT_NETWORK_TIMEOUT_MS),
            tokio::net::TcpStream::connect(addr.clone()),
        )
        .await
        {
            // Successfully connected to the BC device
            Ok(Ok(mut stream)) => {
                log::info!("Connected to bc");
                // Send bc_monitor_started event via WebSocket
                if let Ok(msg) = serde_json::to_string(&json!({
                    "event": "bc_monitor_started",
                    "data": { "address": addr.clone() }
                })) {
                    {
                        let mut guard = sink.lock().await;
                        if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await {
                            log::error!("Failed to send 'bc_monitor_started' via WebSocket: {}", e);
                        }
                    }
                }
                
                // Message processing loop - reads and processes messages from the BC device
                loop {
                    match read_packet(&mut stream).await {
                        // Successfully read and parsed a message
                        Ok(message) => {
                            // Parse message to report (synchronous parsing, returns Result)
                            match parse_message_to_report(message) {
                                Ok(msg_report) => {
                                    // Send parsed report to channel for WebSocket forwarding
                                    if let Err(e) = tx.send(msg_report).await {
                                        log::error!("Failed to send message report: {}", e);
                                    }
                                }
                                Err(e) => {
                                    log::warn!("Failed to parse message: {:?}", e);
                                }
                            }
                        }
                        // Error occurred while reading a message
                        Err(e) => match e {
                            crate::models::SockErrCode::SockDisconnected => {
                                log::error!("SockDisconnected");
                                break;
                            }
                            crate::models::SockErrCode::SockError => {
                                log::error!("SockError");
                            }
                        },
                    }
                    // Check if communication should be stopped
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
                        let mut guard = sink.lock().await;
                        if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await {
                            log::error!("Failed to send 'bc_monitor_stopped' via WebSocket: {}", e);
                        }
                    }
                }
            }
            // Failed to connect to the BC device
            Ok(Err(e)) => {
                log::warn!("Failed to connect to {}: {}", addr, e);
            }
            // Timeout while trying to connect
            Err(_) => {
                log::warn!("Timeout connecting to {}", addr);
                tokio::time::sleep(tokio::time::Duration::from_millis(DEFAULT_NETWORK_TIMEOUT_MS)).await;
            }
        }

        // Check if communication should be stopped
        if !get_bc_comm_running() {
            log::info!("Detected stop bc command.");
            break;
        }
    }
}

/// Task for WebSocket reply
/// This function handles sending message reports to the frontend via WebSocket:
/// 1. Receives MessageReport objects from the channel
/// 2. Converts them to JSON format
/// 3. Sends them to the frontend via WebSocket
/// 
/// Parameters:
/// - sink: WebSocket sink for sending messages to the frontend
/// - rx: Channel receiver for receiving MessageReport objects
async fn websocket_reply_task(
    sink: std::sync::Arc<tokio::sync::Mutex<WebSocketSink>>,
    mut rx: tokio::sync::mpsc::Receiver<MessageReport>,
) {
    // Main message processing loop
    loop {
        match tokio::time::timeout(
            tokio::time::Duration::from_millis(DEFAULT_NETWORK_TIMEOUT_MS), 
            rx.recv()
        ).await
        {
            // Received a message report to send to the frontend
            Ok(Some(message)) => {
                // Send message update event via WebSocket
                if let Ok(msg) = serde_json::to_string(&json!({
                    "event": "msg_updated",
                    "data": message
                })) {
                    {
                        let mut guard = sink.lock().await;
                        if let Err(e) = guard.send(tokio_tungstenite::tungstenite::Message::Text(msg)).await {
                            log::error!("Failed to send message via WebSocket: {}", e);
                        }
                    }
                }
            }
            // Channel has been closed
            Ok(None) => {
                log::info!("Channel closed.");
                break;
            }
            // Timeout occurred while waiting for a message
            Err(_) => {
                // Timeout - continue loop
            }
        }
        // Check if WebSocket server is still running
        if !get_ws_running() {
            log::info!("WebSocket server stopped, exiting reply task.");
            break;
        }
    }
}

/// WebSocket server implementation
/// This struct provides methods to start and manage the WebSocket server.
/// The server listens for incoming WebSocket connections and handles communication
/// with frontend clients.
pub struct WebSocketServer;

impl WebSocketServer {
    /// Start the WebSocket server
    /// This function initializes and starts the WebSocket server:
    /// 1. Checks if the server is already running
    /// 2. Binds to the configured address
    /// 3. Emits a "ws_started" event to the frontend
    /// 4. Enters a blocking loop to accept incoming connections
    /// 5. Spawns a new task for each connection to handle frontend communication
    /// 
    /// Note: This function blocks until the server is stopped (when get_ws_running() returns false).
    /// It should be called from within a spawned async task (e.g., tauri::async_runtime::spawn)
    /// to avoid blocking the application startup.
    /// 
    /// The server loop runs directly in this function (no nested spawn), simplifying
    /// error handling and state management.
    /// 
    /// Parameters:
    /// - _msg_handler: A callback function for handling MessageReport objects
    ///   (currently unused but kept for potential future use)
    pub async fn start(_msg_handler: Box<dyn Fn(MessageReport) + Send>) {
        // Check if WebSocket server is already running
        if get_ws_running() {
            log::info!("WebSocket server is already running.");
            return;
        }
        
        // Set the WebSocket server running flag
        set_ws_running(true);
        
        // Get the configured WebSocket address
        let addr = DEFAULT_WEBSOCKET_ADDR.to_string();
        
        // Bind the TCP listener to the address
        let listener = match tokio::net::TcpListener::bind(addr.clone()).await {
            Ok(listener) => listener,
            Err(e) => {
                log::error!("Failed to bind WebSocket server to {}: {}", addr, e);
                // Reset the running flag on error
                set_ws_running(false);
                return;
            }
        };

        log::info!("Start WebSocket server and listening on ws://{}", addr);

        // Emit a "ws_started" event to notify the frontend
        if let Some(handle) = get_app_handle() {
            if let Err(e) = handle.emit("ws_started", addr.clone()) {
                log::warn!("Failed to emit 'ws_started' event: {}", e);
            }
        }

        // Main server loop to accept incoming connections
        // This loop will run until get_ws_running() returns false
        loop {
            // Check if the WebSocket server should stop
            if !get_ws_running() {
                log::info!("WebSocket server is shutting down.");
                break;
            }

            // Attempt to accept a new connection with a timeout
            match tokio::time::timeout(
                tokio::time::Duration::from_millis(DEFAULT_NETWORK_TIMEOUT_MS),
                listener.accept()
            )
            .await
            {
                // Successfully accepted a new connection
                Ok(Ok((stream, addr))) => {
                    log::info!("New connection from {}", addr);
                    
                    // Attempt to upgrade the connection to a WebSocket with a timeout
                    match tokio::time::timeout(
                        tokio::time::Duration::from_millis(DEFAULT_NETWORK_TIMEOUT_MS),
                        tokio_tungstenite::accept_async(stream),
                    )
                    .await
                    {
                        // Successfully upgraded to WebSocket
                        Ok(Ok(ws_stream)) => {
                            // Spawn a new task to handle communication with this client
                            // This allows the server loop to continue accepting new connections
                            // while each client connection is handled independently
                            tokio::spawn(async move {
                                frontend_communication(ws_stream).await;
                            });
                        }
                        // WebSocket handshake failed
                        Ok(Err(e)) => log::warn!("WebSocket handshake failed: {}", e),
                        // WebSocket handshake timed out
                        Err(_) => log::debug!("WebSocket handshake timed out"),
                    }
                }
                // Error occurred while accepting connection
                Ok(Err(e)) => log::warn!("Error accepting connection: {}", e),
                // Timeout occurred while waiting for a connection
                Err(_) => log::debug!("Connection accept timed out"),
            }
        }
    }
}