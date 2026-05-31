import { useEffect } from 'react';
import { Modal, Form, Input, Select, Checkbox, App } from 'antd';
import { useQuickLinkStore } from '@/stores/quickLinks';
import type { QuickLink } from '@/types/quickLink';

interface AddLinkModalProps {
  open: boolean;
  onClose: () => void;
  editingLink?: QuickLink | null;
}

export default function AddLinkModal({ open, onClose, editingLink }: AddLinkModalProps) {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const { workspaces, createLink, updateLink } = useQuickLinkStore();
  const extraWorkspaces = workspaces.filter((w) => !w.is_default);

  useEffect(() => {
    if (open) {
      if (editingLink) {
        const defaultId = workspaces.find((w) => w.is_default)?.id;
        form.setFieldsValue({
          name: editingLink.name,
          url: editingLink.url,
          icon: editingLink.icon,
          category: editingLink.category,
          workspace_ids: editingLink.workspaces.filter((id) => id !== defaultId),
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingLink, workspaces]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingLink) {
        await updateLink(editingLink.id, values);
        message.success('更新成功');
      } else {
        await createLink(values);
        message.success('创建成功');
      }
      onClose();
    } catch {
      // validation failed
    }
  };

  return (
    <Modal
      title={editingLink ? '编辑链接' : '添加链接'}
      open={open}
      onOk={handleOk}
      onCancel={onClose}
      width={480}
      destroyOnHidden
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入链接名称' }]}>
          <Input placeholder="如：ChatGPT" />
        </Form.Item>
        <Form.Item name="url" label="URL" rules={[{ required: true, message: '请输入链接地址' }, { type: 'url', message: '请输入有效的 URL' }]}>
          <Input placeholder="https://chat.openai.com" />
        </Form.Item>
        <Form.Item name="category" label="分类">
          <Input placeholder="如：AI工具、开发文档" />
        </Form.Item>
        <Form.Item name="icon" label="图标标识">
          <Input placeholder="可选，如 github" />
        </Form.Item>
        <Form.Item
          name="workspace_ids"
          label="额外分配到"
        >
          <Checkbox.Group
            options={extraWorkspaces.map((w) => ({
              label: w.name,
              value: w.id,
            }))}
          />
        </Form.Item>
        {extraWorkspaces.length === 0 && (
          <div style={{ color: '#8c8c8c', fontSize: 12, marginTop: -8 }}>
            所有链接默认分配到默认工作区，可在工作区切换器中创建额外工作区
          </div>
        )}
      </Form>
    </Modal>
  );
}
