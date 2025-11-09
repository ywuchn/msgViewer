//! BC communication handling

use tokio::io::AsyncReadExt;
use std::io::Cursor;
use byteorder::{LittleEndian, ReadBytesExt};

use crate::{
    models::{MessageReport, SockErrCode, MsgHeader},
    utils::{get_node_name, get_msg_name, find_start_flag},
    MAX_MESSAGE_LEN, MSG_HEADER_LEN, US_PER_SEC
};

/// Read data from TCP stream
pub async fn read_data(stream: &mut tokio::net::TcpStream, len: usize) -> Result<Vec<u8>, SockErrCode> {
    // Boundary condition optimization: if len is 0, return empty Vec directly
    if len == 0 {
        return Ok(Vec::new());
    }

    let mut buf = vec![0; len]; // Pre-allocate buffer

    match AsyncReadExt::read_exact(stream, &mut buf).await {
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

/// Read packet from TCP stream
pub async fn read_packet(stream: &mut tokio::net::TcpStream) -> Result<Vec<u8>, SockErrCode> {
    const START_FLAG: u8 = 0x1E;
    const END_FLAG: u8 = 0xE1;
    let mut start_pos: usize = 0;
    let mut read_pos: usize = 0;
    let mut message_buf = [0; MAX_MESSAGE_LEN * 2];

    loop {
        // Read Header
        while read_pos < MSG_HEADER_LEN {
            // Calculate how many bytes we need to read
            let bytes_to_read = MSG_HEADER_LEN - read_pos;
            
            match read_data(stream, bytes_to_read).await {
                Ok(data) => {
                    // Copy data to buffer at the correct position
                    message_buf[start_pos + read_pos..start_pos + read_pos + data.len()].copy_from_slice(&data);
                    read_pos += data.len();
                }
                Err(e) => {
                    return Err(e);
                }
            }

            // Only search for start flag if we have read enough data
            if read_pos >= MSG_HEADER_LEN {
                // locate start flag in the current buffer window
                if let Some(pos) = find_start_flag(
                    &message_buf[start_pos..start_pos + read_pos],
                    START_FLAG,
                ) {
                    if pos == 0 {
                        // Start flag is at position 0, we have a complete header
                        // Parse header using Cursor and byteorder
                        let mut cursor = Cursor::new(&message_buf[start_pos..start_pos + MSG_HEADER_LEN]);
                        let header = MsgHeader {
                            sof: ReadBytesExt::read_u8(&mut cursor).unwrap(),
                            len: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
                            msg_id: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
                            ses_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
                            src_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
                            tgt_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
                            ts_sec: ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).unwrap(),
                            ts_us: ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).unwrap(),
                            seq_num: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
                        };
                        let msg_len = header.len as usize;
                        
                        // Validate message length
                        if msg_len < MSG_HEADER_LEN || msg_len > MAX_MESSAGE_LEN {
                            log::warn!("Invalid message length: {}", msg_len);
                            // Reset and continue searching
                            start_pos = 0;
                            read_pos = 0;
                            continue;
                        }
                        
                        // read payload
                        match read_data(stream, msg_len - MSG_HEADER_LEN).await {
                            Ok(data) => {
                                message_buf[start_pos + MSG_HEADER_LEN..start_pos + msg_len].copy_from_slice(&data);
                            }
                            Err(e) => {
                                return Err(e);
                            }
                        }

                        if message_buf[start_pos + msg_len - 1] != END_FLAG {
                            log::warn!("invalid end flag");
                            // return Err(SockErrCode::InvalidEndFlag);
                        }

                        return Ok(message_buf[start_pos..start_pos + msg_len].to_vec());
                    } else {
                        // Found start flag but not at position 0, discard bytes before start flag
                        // Move valid data (from pos to read_pos) to the beginning of buffer
                        let valid_data_len = read_pos - pos;
                        if start_pos + pos + valid_data_len <= message_buf.len() {
                            message_buf.copy_within(start_pos + pos..start_pos + read_pos, 0);
                        } else {
                            // Fallback: copy manually if copy_within would overflow
                            let src_start = start_pos + pos;
                            for i in 0..valid_data_len {
                                message_buf[i] = message_buf[src_start + i];
                            }
                        }
                        start_pos = 0;
                        // Update read_pos: we have (read_pos - pos) valid bytes, need MSG_HEADER_LEN total
                        read_pos = valid_data_len;
                        // Continue to read the remaining bytes
                        continue;
                    }
                } else {
                    // No start flag found in the read data, discard all and start over
                    start_pos = 0;
                    read_pos = 0;
                    continue;
                }
            }
        }
    }
}

/// Handle incoming message
pub async fn handle_message<F>(msg: Vec<u8>, message_handler: F) 
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

    // Parse message header using Cursor and byteorder
    let mut cursor = Cursor::new(&msg[..MSG_HEADER_LEN]);
    let header = MsgHeader {
        sof: ReadBytesExt::read_u8(&mut cursor).unwrap(),
        len: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
        msg_id: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
        ses_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
        src_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
        tgt_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
        ts_sec: ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).unwrap(),
        ts_us: ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).unwrap(),
        seq_num: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
    };

    // Verify the start flag
    if header.sof != 0x1E {
        log::warn!("Invalid start flag: {:02X}", header.sof);
        return;
    }

    // Fix packed struct alignment issue
    let ts_sec = header.ts_sec;
    let ts_us = header.ts_us;
    let ts = ts_sec as u64 * US_PER_SEC + ts_us as u64;
    let dt = match std::time::UNIX_EPOCH.checked_add(std::time::Duration::from_micros(ts)) {
        Some(duration) => chrono::DateTime::<chrono::Utc>::from(duration),
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
}