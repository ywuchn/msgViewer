/**
 * 消息树视图组件
 * 以树形结构显示消息详细信息
 */

import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import { SimpleTreeView } from '@mui/x-tree-view/SimpleTreeView';
import { TreeItem } from '@mui/x-tree-view/TreeItem';
import { buildMessageTree } from '../../utils/messageTree';
import type { MessageReport } from '../../types';

interface MessageTreeViewProps {
  report: MessageReport;
}

export function MessageTreeView({ report }: MessageTreeViewProps) {
  const tree = buildMessageTree(report);

  return (
    <Paper elevation={1} sx={{ height: '100%', borderRadius: 2, p: 2, overflow: 'auto' }}>
      <Typography variant="h6" gutterBottom sx={{ mb: 2 }}>
        Message Details
      </Typography>
      <SimpleTreeView
        aria-label="message tree"
        defaultExpandedItems={['root', 'payload']}
      >
        {tree.children?.map((node) => (
          <TreeItem
            key={node.id}
            itemId={node.id}
            label={node.label}
          >
            {node.children?.map((child) => (
              <TreeItem
                key={child.id}
                itemId={child.id}
                label={child.label}
              />
            ))}
          </TreeItem>
        ))}
      </SimpleTreeView>
    </Paper>
  );
}

