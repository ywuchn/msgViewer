//! Utility functions used throughout the application

use std::collections::HashMap;
use crate::{MSG_SCM_MCM_AXIS_DATAOUTPUT_SET, MSG_SCM_MCM_MOUNT_SET, MSG_SCM_MCM_INIT_REQ, 
            MSG_SCM_MCM_SURGERY_SET, MSG_SCM_MCM_BU_SET, MSG_MCM_STATUS_NOTIFY, MSG_MC_STATUS_REQ, 
            MSG_MC_STATUS_RSP, MSG_MC_KSYNC_CTRL_REQ, MSG_MC_KSYNC_CTRL_RSP, MSG_MC_STATUS_NTF, 
            MSG_MC_MOTION_CTRL_REQ, MSG_MC_MOTION_CTRL_RSP, MSG_MC_MOUNT_CTRL_REQ, 
            MSG_MC_MOUNT_CTRL_RSP, MSG_MC_DEV_CTRL_REQ, MSG_MC_DEV_CTRL_RSP};

/// Convert node ID to formatted string
pub fn get_node_name(node_id: u8) -> String {
    format!("{:02X}", node_id)
}

/// Get message name from message ID
pub fn get_msg_name(msg_id: u16) -> String {
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

/// Helper function to locate the start flag in a slice.
pub fn find_start_flag(slice: &[u8], flag: u8) -> Option<usize> {
    slice.iter().position(|&ch| ch == flag)
}