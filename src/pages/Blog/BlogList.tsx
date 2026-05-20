import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Typography,
  Chip,
  InputAdornment,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material'
import { Add, Search, Delete, Edit, CalendarToday, Article } from '@mui/icons-material'
import { useBlogStore } from '../../stores'

export default function BlogList() {
  const navigate = useNavigate()
  const { posts, deletePost } = useBlogStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const allTags = [...new Set(posts.flatMap((p) => p.tags))]

  const filteredPosts = posts
    .filter((p) => {
      const matchSearch = !searchQuery || p.title.toLowerCase().includes(searchQuery.toLowerCase())
      const matchTag = !filterTag || p.tags.includes(filterTag)
      return matchSearch && matchTag && p.status === 'published'
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const handleDelete = () => {
    if (deletingId) {
      deletePost(deletingId)
      setDeletingId(null)
    }
    setDeleteDialogOpen(false)
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          博客
        </Typography>
        <Button variant="contained" size="small" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={() => navigate('/blog/new')}>
          写文章
        </Button>
      </Box>

      {/* 搜索和标签筛选 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="搜索文章..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 16 }} />
              </InputAdornment>
            ),
          }}
          sx={{ width: 240 }}
        />
        <Chip label="全部" size="small" variant={filterTag === '' ? 'filled' : 'outlined'} onClick={() => setFilterTag('')} sx={{ height: 24 }} />
        {allTags.map((tag) => (
          <Chip key={tag} label={tag} size="small" variant={filterTag === tag ? 'filled' : 'outlined'} onClick={() => setFilterTag(filterTag === tag ? '' : tag)} sx={{ height: 24 }} />
        ))}
      </Box>

      {filteredPosts.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Article sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {posts.length === 0 ? '还没有发布任何文章' : '没有匹配的文章'}
          </Typography>
          {posts.length === 0 && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={() => navigate('/blog/new')} sx={{ mt: 1 }}>
              写第一篇文章
            </Button>
          )}
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 1 }}>标题</TableCell>
                <TableCell sx={{ py: 1 }}>分类</TableCell>
                <TableCell sx={{ py: 1 }}>标签</TableCell>
                <TableCell sx={{ py: 1 }}>摘要</TableCell>
                <TableCell sx={{ py: 1 }}>日期</TableCell>
                <TableCell sx={{ py: 1 }} align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPosts.map((post) => (
                <TableRow
                  key={post.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/blog/${post.id}`)}
                >
                  <TableCell sx={{ py: 0.75, fontWeight: 500, fontSize: 13 }}>{post.title}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    {post.category && <Chip label={post.category} size="small" color="primary" variant="outlined" sx={{ height: 20, fontSize: 11 }} />}
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                      {post.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" sx={{ height: 20, fontSize: 11 }} />
                      ))}
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, color: 'text.secondary', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {post.summary || post.content.slice(0, 60)}
                  </TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, color: 'text.secondary' }}>
                    {formatDate(post.createdAt)}
                  </TableCell>
                  <TableCell sx={{ py: 0.75 }} align="right">
                    <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); navigate(`/blog/edit/${post.id}`) }}>
                      <Edit sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ p: 0.25 }}
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation()
                        setDeletingId(post.id)
                        setDeleteDialogOpen(true)
                      }}
                    >
                      <Delete sx={{ fontSize: 14 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>确认删除</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography variant="body2">确定要删除这篇文章吗？此操作不可恢复。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete} size="small">删除</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
