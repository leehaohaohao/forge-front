import { useState, useEffect } from 'react';
import { Card, Input, Tabs, Typography, Empty, Row, Col, Pagination } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useKnowledgeStore } from '@/stores/knowledge';
import * as knowledgeApi from '@/services/knowledge';
import DocumentCard from '@/components/knowledge/DocumentCard';
import type { Document } from '@/types/knowledge';

const { Text } = Typography;

export default function KnowledgeSquarePage() {
  const [activeTab, setActiveTab] = useState('latest');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      const params = { page, page_size: pageSize, keyword: keyword || undefined };
      let res;
      if (activeTab === 'hot') {
        res = await knowledgeApi.getSquareHot(params);
      } else if (activeTab === 'search' && keyword) {
        res = await knowledgeApi.getSquareSearch(params);
      } else {
        res = await knowledgeApi.getSquareLatest(params);
      }
      setDocuments(res.data);
      setTotal(res.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, [activeTab, page, pageSize]);

  const handleSearch = () => {
    if (keyword.trim()) {
      setActiveTab('search');
    } else {
      setActiveTab('latest');
    }
    setPage(1);
    fetchDocs();
  };

  return (
    <Card style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }} styles={{ body: { padding: 0 } }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Text strong style={{ fontSize: 16 }}>知识广场</Text>
          <Input.Search
            placeholder="搜索公开知识..."
            allowClear
            enterButton={<SearchOutlined />}
            style={{ width: 300 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
          />
        </div>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => { setActiveTab(key); setPage(1); }}
          items={[
            { key: 'latest', label: '最新发布' },
            { key: 'hot', label: '热门文章' },
          ]}
        />
      </div>

      <div style={{ padding: '16px 24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 48, color: '#8c8c8c' }}>加载中...</div>
        ) : documents.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无内容" />
        ) : (
          <>
            <Row gutter={[16, 16]}>
              {documents.map((doc) => (
                <Col key={doc.id} xs={24} sm={12} md={8} lg={6}>
                  <DocumentCard doc={doc} />
                </Col>
              ))}
            </Row>
            {total > pageSize && (
              <div style={{ marginTop: 24, textAlign: 'center' }}>
                <Pagination
                  current={page}
                  pageSize={pageSize}
                  total={total}
                  showSizeChanger
                  showTotal={(t) => `共 ${t} 篇`}
                  onChange={(p, ps) => { setPage(p); setPageSize(ps); }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
