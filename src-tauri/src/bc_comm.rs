//! BC communication handling

use tokio::io::AsyncReadExt;
use std::io::Cursor;
use byteorder::{LittleEndian, ReadBytesExt};

use crate::{
    models::{MessageReport, SockErrCode, MsgHeader, BcMessage, MAX_MESSAGE_LEN, MSG_HEADER_LEN, START_FLAG, END_FLAG, START_FLAG_LEN, END_FLAG_LEN, CRC_LEN},
    utils::{get_node_name, get_msg_name},
    US_PER_SEC
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
/// Message structure: start_flag(0x1E) + header + payload + crc(2 bytes) + end_flag(0xE1)
/// Returns complete BcMessage structure with all parts
pub async fn read_packet(stream: &mut tokio::net::TcpStream) -> Result<BcMessage, SockErrCode> {

    loop {
        // Step 1: Find start flag by reading one byte at a time
        loop {
            let mut byte_buf = [0u8; 1];
            match stream.read_exact(&mut byte_buf).await {
                Ok(_) => {
                    if byte_buf[0] == START_FLAG {
                        // Found start flag, break to read header
                        break;
                    }
                    // Not start flag, discard and continue searching
                }
                Err(e) => {
                    if e.kind() == std::io::ErrorKind::UnexpectedEof {
                        log::error!("Connection closed by peer");
                        return Err(SockErrCode::SockDisconnected);
                    } else {
                        log::error!("Read failed: {}", e);
                        return Err(SockErrCode::SockError);
                    }
                }
            }
        }

        // Step 2: Read header (after start flag)
        let header_bytes = match read_data(stream, MSG_HEADER_LEN).await {
            Ok(data) => data,
            Err(e) => return Err(e),
        };

        // Step 3: Parse header
        let mut cursor = Cursor::new(&header_bytes);
        let header = MsgHeader {
            len: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
            msg_id: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
            ses_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
            src_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
            tgt_id: ReadBytesExt::read_u8(&mut cursor).unwrap(),
            ts_sec: ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).unwrap(),
            ts_us: ReadBytesExt::read_u32::<LittleEndian>(&mut cursor).unwrap(),
            seq_num: ReadBytesExt::read_u16::<LittleEndian>(&mut cursor).unwrap(),
        };
        let total_msg_len = header.len as usize;
        
        // Step 4: Validate message length
        // Total length = start_flag(1) + header + payload + crc(2) + end_flag(1)
        let min_len = START_FLAG_LEN + MSG_HEADER_LEN + CRC_LEN + END_FLAG_LEN;
        if total_msg_len < min_len || total_msg_len > MAX_MESSAGE_LEN {
            log::warn!("Invalid message length: {} (min: {}, max: {})", total_msg_len, min_len, MAX_MESSAGE_LEN);
            // Continue searching for next start flag
            continue;
        }
        
        // Step 5: Calculate payload length: total - start_flag - header - crc - end_flag
        let payload_len = total_msg_len - START_FLAG_LEN - MSG_HEADER_LEN - CRC_LEN - END_FLAG_LEN;
        
        // Step 6: Read payload
        let payload = match read_data(stream, payload_len).await {
            Ok(data) => data,
            Err(e) => return Err(e),
        };
        
        // Step 7: Read and verify CRC (2 bytes)
        let crc_bytes = match read_data(stream, CRC_LEN).await {
            Ok(data) => data,
            Err(e) => return Err(e),
        };
        // Convert CRC bytes to u16 (little endian)
        let mut crc_cursor = Cursor::new(&crc_bytes);
        let crc = ReadBytesExt::read_u16::<LittleEndian>(&mut crc_cursor).unwrap();
        // TODO: Verify CRC if needed
        
        // Step 8: Read and verify end flag (1 byte)
        let end_flag_data = match read_data(stream, END_FLAG_LEN).await {
            Ok(data) => data,
            Err(e) => return Err(e),
        };
        
        if end_flag_data[0] != END_FLAG {
            log::warn!("Invalid end flag: {:02X}, expected {:02X}", end_flag_data[0], END_FLAG);
            // Continue searching for next start flag
            continue;
        }

        // Step 9: Return complete BcMessage
        return Ok(BcMessage {
            start_flag: START_FLAG,
            header,
            payload,
            crc,
            end_flag: END_FLAG,
        });
    }
}

/// Handle incoming message
/// Takes complete BcMessage structure
pub async fn handle_message<F>(message: BcMessage, message_handler: F) 
where 
    F: FnOnce(MessageReport),
{
    let header = message.header;
    let payload = message.payload;

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
    let payload_str = {
        let mut result = String::with_capacity(payload.len() * 3); // Estimate capacity
        for (i, byte) in payload.iter().enumerate() {
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
        payload: payload_str,
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