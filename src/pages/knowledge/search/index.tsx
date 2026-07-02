import { useState, useEffect } from 'react';
import { Card, Input, Typography, Empty, Row, Col, Pagination, Spin, Tag, Space } from 'antd';
import { SearchOutlined, FileTextOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getDocuments } from '@/services/knowledge';
import type { Document } from '@/types/knowledge';
import dayjs from 'dayjs';

const { Text, Paragraph } = Typography;

export default function SearchPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';

  const [keyword, setKeyword] = useState(query);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(false);

  const doSearch = async (kw: string, p: number, ps: number) => {
    if (!kw.trim()) {
      setDocuments([]);
      setTotal(0);
      return;
    }
    setLoading(true);
    try {
      const res = await getDocuments({ keyword: kw, page: p, page_size: ps });
      setDocuments(res.data);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (query) {
      setKeyword(query);
      doSearch(query, page, pageSize);
    }
  }, [query]);

  const handleSearch = (value: string) => {
    const kw = value.trim();
    if (!kw) return;
    setSearchParams({ q: kw });
    setPage(1);
    doSearch(kw, 1, pageSize);
  };

  const handlePageChange = (p: number, ps: number) => {
    setPage(p);
    setPageSize(ps);
    doSearch(query, p, ps);
  };

  return (
    <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <Input.Search
          placeholder="搜索文档..."
          allowClear
          enterButton={<SearchOutlined />}
          size="large"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onSearch={handleSearch}
          style={{ maxWidth: 600 }}
        />
      </div>

      <div style={{ padding: '16px 24px' }}>
        {query && (
          <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
            搜索 "{query}" 共找到 {total} 个结果
          </Text>
        )}

        <Spin spinning={loading}>
          {!query ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="输入关键词开始搜索" />
          ) : documents.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到相关内容" />
          ) : (
            <>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid #f5f5f5',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate(`/knowledge/document/${doc.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <FileTextOutlined style={{ color: '#1677ff' }} />
                    <Text strong style={{ fontSize: 15, color: '#1677ff' }}>{doc.title}</Text>
                    {doc.status === 1 && <Tag color="green" style={{ marginLeft: 4 }}>已发布</Tag>}
                    {doc.status === 0 && <Tag style={{ marginLeft: 4 }}>草稿</Tag>}
                  </div>
                  {doc.summary && (
                    <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 6, marginLeft: 24 }}>
                      {doc.summary}
                    </Paragraph>
                  )}
                  {doc.tags && doc.tags.length > 0 && (
                    <Space size={[0, 4]} wrap style={{ marginLeft: 24 }}>
                      {doc.tags.map((tag) => <Tag key={tag}>{tag}</Tag>)}
                    </Space>
                  )}
                  <div style={{ marginLeft: 24, marginTop: 4 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {dayjs(doc.updated_at).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </div>
                </div>
              ))}
              {total > pageSize && (
                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <Pagination
                    current={page}
                    pageSize={pageSize}
                    total={total}
                    showSizeChanger
                    showTotal={(t) => `共 ${t} 条`}
                    onChange={handlePageChange}
                  />
                </div>
              )}
            </>
          )}
        </Spin>
      </div>
    </Card>
  );
}
