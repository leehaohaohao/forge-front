import { useEffect, useState, useCallback } from 'react';
import { Card, Form, Switch, Button, Space, Typography, App } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useSettingsStore } from '@/stores/settings';
import type { Settings } from '@/types/settings';

const { Text } = Typography;

const modifierKeys = new Set(['Control', 'Shift', 'Alt', 'Meta']);
const keyDisplayMap: Record<string, string> = {
  Control: 'Ctrl',
  Shift: 'Shift',
  Alt: 'Alt',
  Meta: 'Meta',
};

function ShortcutInput({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  const [recording, setRecording] = useState(false);
  const [display, setDisplay] = useState(value || '');

  useEffect(() => {
    setDisplay(value || '');
  }, [value]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (modifierKeys.has(e.key)) return;

      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.shiftKey) parts.push('Shift');
      if (e.altKey) parts.push('Alt');
      if (e.metaKey) parts.push('Meta');

      let mainKey = e.key;
      if (mainKey.length === 1) mainKey = mainKey.toUpperCase();
      parts.push(mainKey);

      const combo = parts.join('+');
      setDisplay(combo);
      onChange?.(combo);
      setRecording(false);
    },
    [onChange],
  );

  return (
    <div
      tabIndex={0}
      onKeyDown={recording ? handleKeyDown : undefined}
      onClick={() => setRecording(true)}
      style={{
        padding: '4px 11px',
        border: '1px solid #d9d9d9',
        borderRadius: 6,
        cursor: 'pointer',
        minWidth: 160,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        background: recording ? '#e6f4ff' : '#fff',
        borderColor: recording ? '#1677ff' : '#d9d9d9',
        outline: recording ? '2px solid rgba(22,119,255,0.1)' : 'none',
      }}
    >
      <Text type={recording ? undefined : 'secondary'} style={{ fontSize: 13 }}>
        {recording ? '请按下快捷键...' : display || '未设置'}
      </Text>
    </div>
  );
}

export default function SettingsPage() {
  const { message } = App.useApp();
  const { settings, loading, fetchSettings, updateSettings, resetSettings } = useSettingsStore();
  const [form] = Form.useForm();
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    form.setFieldsValue(settings);
  }, [settings, form]);

  const handleValuesChange = (_: Partial<Settings>, allValues: Settings) => {
    updateSettings(allValues);
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      await resetSettings();
      message.success('已恢复默认设置');
    } catch {
      message.error('重置失败');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Text strong style={{ fontSize: 18 }}>
          用户设置
        </Text>
        <Button icon={<ReloadOutlined />} loading={resetting} onClick={handleReset}>
          恢复默认
        </Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        initialValues={settings}
        onValuesChange={handleValuesChange}
      >
        <Card title="快捷链接" style={{ marginBottom: 16 }} styles={{ body: { paddingTop: 12 } }}>
          <Form.Item name={['quickLink', 'panelDefaultOpen']} label="首页自动展开快捷面板" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name={['quickLink', 'openInNewTab']} label="链接在新标签页打开" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>

        <Card title="快捷键" style={{ marginBottom: 16 }} styles={{ body: { paddingTop: 12 } }}>
          <Form.Item name={['shortcuts', 'togglePanel']} label="切换快捷面板">
            <ShortcutInput />
          </Form.Item>
          <Form.Item name={['shortcuts', 'openSearch']} label="全局搜索（预留）">
            <ShortcutInput />
          </Form.Item>
        </Card>

        <Card title="外观" style={{ marginBottom: 16 }} styles={{ body: { paddingTop: 12 } }}>
          <Form.Item name={['theme', 'sidebarCollapsed']} label="侧边栏默认收起" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Card>
      </Form>
    </div>
  );
}
