/**
 * 验证工具函数
 * IP 地址和端口号验证
 */

const IPV4_SEGMENT_REGEX = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const PORT_REGEX = /^(6553[0-5]|655[0-2]\d|65[0-4]\d{2}|6[0-4]\d{3}|[1-5]\d{4}|[1-9]\d{0,3})$/;

/**
 * 验证 IPv4 地址段是否有效
 */
export function isValidIpSegment(segment: string): boolean {
  return IPV4_SEGMENT_REGEX.test(segment);
}

/**
 * 验证 IPv4 地址是否有效
 * @param ipAddress - 要验证的 IP 地址
 * @returns 如果 IP 地址有效或为空则返回 true
 */
export function validateIpAddress(ipAddress: string): boolean {
  if (typeof ipAddress !== "string") {
    return false;
  }

  if (ipAddress.trim() === "") {
    return true;
  }

  const segments = ipAddress.split(".");
  if (segments.length !== 4) {
    return false;
  }

  for (const segment of segments) {
    if (!isValidIpSegment(segment)) {
      return false;
    }
  }
  return true;
}

/**
 * 验证端口号是否有效
 * @param portNumber - 要验证的端口号
 * @returns 如果端口号有效（1-65535）或为空则返回 true
 */
export function validatePortNumber(portNumber: string): boolean {
  if (portNumber.length === 0) {
    return true;
  }
  return PORT_REGEX.test(portNumber);
}

