//! Configuration management for the application

/// Default WebSocket server address
pub const DEFAULT_WEBSOCKET_ADDR: &str = "127.0.0.1:8080";

/// Default buffer size for message channels
pub const DEFAULT_CHANNEL_BUFFER_SIZE: usize = 100;

/// Default timeout for network operations (in milliseconds)
pub const DEFAULT_NETWORK_TIMEOUT_MS: u64 = 500;

/// Maximum length of payload to display in the UI
pub const MAX_DISPLAY_PAYLOAD_LENGTH: usize = 100;