import { useState, useRef, useEffect, useCallback } from 'react';
import { Input, Spin, Typography, Tag, Space, Empty } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getDocuments } from '@/services/knowledge';
import type { Document } from '@/types/knowledge';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const [keyword, setKeyword] = useState('');
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await getDocuments({ keyword: kw, page: 1, page_size: 8 });
      setResults(res.data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (value: string) => {
    setKeyword(value);
    if (!value.trim()) {
      setResults([]);
      setOpen(false);
      clearTimeout(debounceRef.current);
      return;
    }
    setOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleSelect = (id: number) => {
    setOpen(false);
    setKeyword('');
    setResults([]);
    navigate(`/knowledge/document/${id}`);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} style={{ position: 'relative', flex: 1, display: 'flex', justifyContent: 'center' }}>
      <Input
        placeholder="搜索..."
        allowClear
        prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
        value={keyword}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={() => { if (keyword.trim() && results.length > 0) setOpen(true); }}
        style={{ width: 400, maxWidth: '100%' }}
      />

      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            marginTop: 4,
            width: 520,
            maxHeight: 440,
            background: '#fff',
            borderRadius: 8,
            boxShadow: '0 6px 24px rgba(0,0,0,0.12)',
            border: '1px solid #f0f0f0',
            overflow: 'auto',
            zIndex: 1050,
          }}
        >
          {loading ? (
            <div style={{ textAlign: 'center', padding: 32 }}>
              <Spin size="small" />
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: 24 }}>
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到相关内容" />
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {results.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    padding: '12px 20px',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  onClick={() => handleSelect(doc.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <FileTextOutlined style={{ color: '#1677ff', fontSize: 13 }} />
                    <Text strong style={{ fontSize: 14, color: '#1677ff' }} ellipsis>{doc.title}</Text>
                    {doc.status === 1 && <Tag color="green" style={{ marginLeft: 'auto', fontSize: 11 }}>已发布</Tag>}
                    {doc.status === 0 && <Tag style={{ marginLeft: 'auto', fontSize: 11 }}>草稿</Tag>}
                  </div>
                  {doc.summary && (
                    <Paragraph type="secondary" ellipsis={{ rows: 1 }} style={{ marginBottom: 4, marginLeft: 21, fontSize: 13 }}>
                      {doc.summary}
                    </Paragraph>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 21 }}>
                    {doc.tags && doc.tags.length > 0 && (
                      <Space size={[0, 4]} wrap>
                        {doc.tags.slice(0, 3).map((tag) => <Tag key={tag} style={{ fontSize: 11 }}>{tag}</Tag>)}
                      </Space>
                    )}
                    <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
                      {dayjs(doc.updated_at).format('MM-DD HH:mm')}
                    </Text>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
