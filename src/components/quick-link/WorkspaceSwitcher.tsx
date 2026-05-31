import { useState } from 'react';
import { Select, Button, Space, Input, Popconfirm, App } from 'antd';
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuickLinkStore } from '@/stores/quickLinks';
import type { Workspace } from '@/types/quickLink';

export default function WorkspaceSwitcher() {
  const { message } = App.useApp();
  const { workspaces, currentWorkspaceId, setCurrentWorkspace, createWorkspace, deleteWorkspace } =
    useQuickLinkStore();
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      await createWorkspace(name);
      setNewName('');
      setAdding(false);
      message.success('工作区创建成功');
    } catch {
      message.error('创建失败');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteWorkspace(id);
      message.success('已删除');
    } catch {
      message.error('删除失败');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: adding ? 8 : 0 }}>
        <Select
          value={currentWorkspaceId}
          onChange={setCurrentWorkspace}
          style={{ flex: 1 }}
          popupMatchSelectWidth={false}
          options={workspaces.map((w: Workspace) => ({
            value: w.id,
            label: (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>
                  {w.name}
                  {w.is_default ? ' (默认)' : ''}
                </span>
                {!w.is_default && (
                  <Popconfirm title="确定删除此工作区？" onConfirm={() => handleDelete(w.id)} okText="删除" cancelText="取消">
                    <DeleteOutlined
                      style={{ color: '#ff4d4f', fontSize: 12 }}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </Popconfirm>
                )}
              </div>
            ),
          }))}
        />
        <Button
          type="text"
          icon={<PlusOutlined />}
          size="small"
          onClick={() => setAdding(!adding)}
        />
      </div>
      {adding && (
        <Space.Compact style={{ width: '100%' }}>
          <Input
            placeholder="新工作区名称"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onPressEnter={handleAdd}
            size="small"
          />
          <Button size="small" type="primary" onClick={handleAdd}>
            添加
          </Button>
        </Space.Compact>
      )}
    </div>
  );
}
