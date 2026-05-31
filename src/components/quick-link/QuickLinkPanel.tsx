import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Typography, Button } from 'antd';
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import { useQuickLinkStore } from '@/stores/quickLinks';
import type { QuickLink } from '@/types/quickLink';
import WorkspaceSwitcher from './WorkspaceSwitcher';
import LinkItem from './LinkItem';
import EmptyGuide from './EmptyGuide';
import AddLinkModal from './AddLinkModal';

const { Text } = Typography;

export default function QuickLinkPanel() {
  const { panelVisible, links, searchKeyword, loading, closePanel, setSearchKeyword, fetchLinks, fetchWorkspaces } =
    useQuickLinkStore();

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<QuickLink | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const filteredLinks = useMemo(() => {
    if (!searchKeyword.trim()) return links;
    const kw = searchKeyword.toLowerCase();
    return links.filter(
      (l) => l.name.toLowerCase().includes(kw) || l.url.toLowerCase().includes(kw),
    );
  }, [links, searchKeyword]);

  const groupedLinks = useMemo(() => {
    const groups: Record<string, QuickLink[]> = {};
    for (const link of filteredLinks) {
      const cat = link.category || '未分类';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(link);
    }
    return groups;
  }, [filteredLinks]);

  const flatLinks = useMemo(() => filteredLinks, [filteredLinks]);

  useEffect(() => {
    if (panelVisible) {
      setSelectedIndex(0);
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [panelVisible]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [searchKeyword]);

  const handleSearchChange = useCallback(
    (value: string) => {
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchKeyword(value);
      }, 150);
    },
    [setSearchKeyword],
  );

  const openLink = useCallback(
    (link: QuickLink) => {
      window.open(link.url, '_blank');
      closePanel();
    },
    [closePanel],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closePanel();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, flatLinks.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter' && flatLinks[selectedIndex]) {
        openLink(flatLinks[selectedIndex]);
      }
    },
    [flatLinks, selectedIndex, openLink, closePanel],
  );

  useEffect(() => {
    if (!panelVisible) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (modalOpen) return;
      const target = e.target as HTMLElement;
      if (target.closest('.ant-select-dropdown, .ant-dropdown, .ant-popover, .ant-modal-wrap')) return;
      if (panelRef.current && !panelRef.current.contains(target)) {
        closePanel();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [panelVisible, closePanel, modalOpen]);

  const handleAdd = () => {
    setEditingLink(null);
    setModalOpen(true);
  };

  if (!panelVisible) return null;

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'center',
          paddingTop: '12vh',
        }}
      >
        <div
          ref={panelRef}
          onKeyDown={handleKeyDown}
          style={{
            width: 640,
            maxHeight: '60vh',
            background: '#fff',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <div style={{ flex: 1 }}>
              <WorkspaceSwitcher />
            </div>
            <Button type="text" icon={<CloseOutlined />} size="small" onClick={closePanel} />
          </div>

          {/* Search */}
          <div style={{ padding: '8px 16px', borderBottom: '1px solid #f0f0f0' }}>
            <input
              ref={searchRef}
              placeholder="搜索链接..."
              onChange={(e) => handleSearchChange(e.target.value)}
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                fontSize: 14,
                padding: '6px 0',
                background: 'transparent',
              }}
            />
          </div>

          {/* Links */}
          <div style={{ flex: 1, overflow: 'auto', padding: '8px 16px' }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: 24, color: '#8c8c8c' }}>加载中...</div>
            ) : flatLinks.length === 0 ? (
              <EmptyGuide onAdd={handleAdd} />
            ) : (
              Object.entries(groupedLinks).map(([category, categoryLinks]) => (
                <div key={category} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 500, marginBottom: 8 }}>
                    {category}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {categoryLinks.map((link) => {
                      const idx = flatLinks.indexOf(link);
                      return (
                        <LinkItem
                          key={link.id}
                          name={link.name}
                          url={link.url}
                          selected={idx === selectedIndex}
                          onClick={() => openLink(link)}
                        />
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div style={{ borderTop: '1px solid #f0f0f0', padding: '8px 16px' }}>
            <Button type="dashed" icon={<PlusOutlined />} block size="small" onClick={handleAdd}>
              添加链接
            </Button>
          </div>
        </div>
      </div>

      <AddLinkModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        editingLink={editingLink}
      />
    </>
  );
}
