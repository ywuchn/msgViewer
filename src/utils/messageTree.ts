/**
 * 消息树构建工具
 * 将消息报告转换为树形结构
 */

import type { MessageReport, TreeNode } from '../types';

/**
 * 构建消息树结构
 * @param report - 消息报告
 * @returns 树形结构节点
 */
export function buildMessageTree(report: MessageReport): TreeNode {
  const root: TreeNode = {
    id: 'root',
    label: 'Message',
    children: [
      {
        id: 'datetime',
        label: `Time: ${report.datetime}`
      },
      {
        id: 'messageId',
        label: `Message ID: ${report.messageId}`
      },
      {
        id: 'sender',
        label: `Sender: ${report.sender}`
      },
      {
        id: 'receiver',
        label: `Receiver: ${report.receiver}`
      }
    ]
  };

  if (report.payload) {
    const bytes = report.payload.split(' ');
    const payloadNode: TreeNode = {
      id: 'payload',
      label: 'Payload',
      children: bytes.map((byte, index) => ({
        id: `byte-${index}`,
        label: `Byte ${index}: ${byte}`
      }))
    };
    root.children?.push(payloadNode);
  }

  return root;
}

