//! Data models and structures used throughout the application

// Message protocol constants
/// Maximum message length (including all parts: start_flag + header + payload + crc + end_flag)
pub const MAX_MESSAGE_LEN: usize = 2000;

/// Start flag value (0x1E)
pub const START_FLAG: u8 = 0x1E;

/// End flag value (0xE1)
pub const END_FLAG: u8 = 0xE1;

/// Start flag length in bytes
pub const START_FLAG_LEN: usize = 1;

/// End flag length in bytes
pub const END_FLAG_LEN: usize = 1;

/// CRC checksum length in bytes
pub const CRC_LEN: usize = 2;

/// Message header structure for parsing binary messages
/// Note: start flag (0x1E) is not part of the header, it comes before the header
/// 
/// This struct uses `#[repr(packed)]` to match C/C++ `pack(1)` alignment.
/// Field sizes: len(2) + msg_id(2) + ses_id(1) + src_id(1) + tgt_id(1) + ts_sec(4) + ts_us(4) + seq_num(2) = 17 bytes
#[repr(packed)]
#[derive(Debug, Copy, Clone)]
pub struct MsgHeader {
    pub len: u16,    // Total message length (start_flag + header + payload + crc + end_flag)
    pub msg_id: u16, // message id
    pub ses_id: u8,  // session id
    pub src_id: u8,  // source
    pub tgt_id: u8,  // target
    pub ts_sec: u32, // second from 1970/1/1
    pub ts_us: u32,  // us portion
    pub seq_num: u16,
}

/// Message header length in bytes
/// This matches C/C++ pack(1) alignment: 2+2+1+1+1+4+4+2 = 17 bytes
/// 
/// # Note
/// This constant is calculated at compile time using `std::mem::size_of::<MsgHeader>()`.
/// With `#[repr(packed)]`, the struct has no padding, so the size equals the sum of all field sizes.
/// 
/// Manual calculation: len(2) + msg_id(2) + ses_id(1) + src_id(1) + tgt_id(1) + ts_sec(4) + ts_us(4) + seq_num(2) = 17 bytes
pub const MSG_HEADER_LEN: usize = std::mem::size_of::<MsgHeader>();

// Compile-time assertion to ensure MSG_HEADER_LEN is correct (17 bytes for pack(1))
const _: [(); 1] = [(); (MSG_HEADER_LEN == 17) as usize];

// Implement default constructor for MsgHeader
impl MsgHeader {
    pub fn new() -> Self {
        MsgHeader {
            len: 0,
            msg_id: 0,
            ses_id: 0,
            src_id: 0,
            tgt_id: 0,
            ts_sec: 0,
            ts_us: 0,
            seq_num: 0,
        }
    }
}

#[derive(Debug, Clone)]
pub struct BcMessage {
    pub start_flag: u8,
    pub header: MsgHeader,
    pub payload: Vec<u8>,
    pub crc: u16,
    pub end_flag: u8,
}


/// Report structure for parsed messages
#[derive(Clone, serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MessageReport {
    pub datetime: String,
    pub sender: String,
    pub receiver: String,
    pub message_id: String,
    pub payload: String,
}

/// Command structure for frontend communication
#[derive(serde::Deserialize)]
pub struct FrontEndCommand {
    pub command: String,
    pub content: String,
}

/// Error codes for socket operations
#[derive(Debug)]
pub enum SockErrCode {
    SockDisconnected,
    SockError,
}

/// Error type for message parsing operations
#[derive(Debug)]
pub enum MessageParseError {
    /// Invalid timestamp in message header
    InvalidTimestamp { ts_sec: u32, ts_us: u32 },
}
