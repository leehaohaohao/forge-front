import { useState, useEffect } from 'react';
import { Card, Button, Space, Form, Input, Select, Typography, App, Row, Col } from 'antd';
import { SaveOutlined, SendOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import { useKnowledgeStore } from '@/stores/knowledge';
import MarkdownEditor from '@/components/knowledge/MarkdownEditor';

const { Text } = Typography;

export default function DocumentEditPage() {
  const { message } = App.useApp();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;

  const {
    spaces,
    folders,
    currentDocument,
    fetchSpaces,
    fetchFolders,
    fetchDocument,
    createDocument,
    updateDocument,
    publishDocument,
    clearDocument,
  } = useKnowledgeStore();

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [spaceId, setSpaceId] = useState<number | null>(null);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [visibility, setVisibility] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSpaces();
    return () => clearDocument();
  }, []);

  useEffect(() => {
    if (isEdit) {
      fetchDocument(Number(id)).then((doc) => {
        setTitle(doc.title);
        setContent(doc.content || '');
        setSummary(doc.summary || '');
        setTags(doc.tags || []);
        setSpaceId(doc.space_id);
        setFolderId(doc.folder_id);
        setVisibility(doc.visibility);
        if (doc.space_id) fetchFolders(doc.space_id);
      });
    }
  }, [id]);

  useEffect(() => {
    if (spaceId) {
      fetchFolders(spaceId);
      setFolderId(null);
    }
  }, [spaceId]);

  const handleSave = async (status?: number) => {
    if (!title.trim()) {
      message.warning('请输入标题');
      return;
    }
    setSaving(true);
    try {
      const data = {
        title: title.trim(),
        content,
        summary,
        tags,
        space_id: spaceId,
        folder_id: folderId,
        visibility,
        ...(status !== undefined && { status }),
      };

      if (isEdit) {
        await updateDocument(Number(id), data);
        if (status === 1) await publishDocument(Number(id));
        message.success('保存成功');
      } else {
        await createDocument(data);
        message.success('创建成功');
      }
      navigate('/knowledge');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {/* 顶部操作栏 */}
      <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', marginBottom: 16 }} styles={{ body: { padding: '12px 24px' } }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/knowledge')}>
              返回
            </Button>
            <Text strong style={{ fontSize: 16 }}>{isEdit ? '编辑文档' : '新建文档'}</Text>
          </Space>
          <Space>
            <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave()}>
              保存草稿
            </Button>
            <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={() => handleSave(1)}>
              发布
            </Button>
          </Space>
        </div>
      </Card>

      <Row gutter={16}>
        {/* 左侧编辑区 */}
        <Col flex="1">
          <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '16px 24px 0' }}>
              <Input
                placeholder="输入文档标题..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                variant="borderless"
                style={{ fontSize: 24, fontWeight: 600, padding: '4px 0' }}
              />
            </div>
            <div style={{ padding: '0 24px 24px' }}>
              <MarkdownEditor value={content} onChange={setContent} height={600} />
            </div>
          </Card>
        </Col>

        {/* 右侧属性面板 */}
        <Col flex="280px">
          <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 16 } }}>
            <Form layout="vertical" size="small">
              <Form.Item label="所属空间">
                <Select
                  allowClear
                  placeholder="选择空间（留空为根目录）"
                  value={spaceId}
                  onChange={setSpaceId}
                  options={spaces.map((s) => ({ value: s.id, label: s.name }))}
                />
              </Form.Item>

              {spaceId && folders.length > 0 && (
                <Form.Item label="所属文件夹">
                  <Select
                    allowClear
                    placeholder="选择文件夹（可选）"
                    value={folderId}
                    onChange={setFolderId}
                    options={folders.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </Form.Item>
              )}

              <Form.Item label="摘要">
                <Input.TextArea
                  rows={3}
                  placeholder="文档摘要，可选"
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                />
              </Form.Item>

              <Form.Item label="标签">
                <Select
                  mode="tags"
                  placeholder="输入标签，回车确认"
                  value={tags}
                  onChange={setTags}
                />
              </Form.Item>

              <Form.Item label="可见性">
                <Select
                  value={visibility}
                  onChange={setVisibility}
                  options={[
                    { value: 0, label: '私有' },
                    { value: 1, label: '公开' },
                  ]}
                />
              </Form.Item>
            </Form>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
