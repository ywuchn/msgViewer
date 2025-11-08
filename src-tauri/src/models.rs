//! Data models and structures used throughout the application

use bytemuck::{Pod, Zeroable};

/// Message header structure for parsing binary messages
#[derive(Debug, Copy, Clone, Pod, Zeroable)]
#[repr(C, packed)]
pub struct MsgHeader {
    pub sof: u8,
    pub len: u16,
    pub msg_id: u16, // message id
    pub ses_id: u8,  // session id
    pub src_id: u8,  // source
    pub tgt_id: u8,  // target
    pub ts_sec: u32, // second from 1970/1/1
    pub ts_us: u32,  // us portion
    pub seq_num: u16,
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