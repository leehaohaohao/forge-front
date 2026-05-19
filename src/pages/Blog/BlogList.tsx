import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActionArea,
  Typography,
  Chip,
  Grid,
  InputAdornment,
  TextField,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material'
import { Add, Search, Delete, Edit, CalendarToday } from '@mui/icons-material'
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
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          博客
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/blog/new')}>
          写文章
        </Button>
      </Box>

      {/* 搜索和标签筛选 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder="搜索文章..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ flex: 1, maxWidth: 400 }}
        />
        {allTags.length > 0 && (
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
            <Chip
              label="全部"
              size="small"
              variant={filterTag === '' ? 'filled' : 'outlined'}
              onClick={() => setFilterTag('')}
            />
            {allTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={filterTag === tag ? 'filled' : 'outlined'}
                onClick={() => setFilterTag(filterTag === tag ? '' : tag)}
              />
            ))}
          </Box>
        )}
      </Box>

      {filteredPosts.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            {posts.length === 0 ? '还没有发布任何文章' : '没有匹配的文章'}
          </Typography>
          {posts.length === 0 && (
            <Button variant="outlined" startIcon={<Add />} onClick={() => navigate('/blog/new')} sx={{ mt: 2 }}>
              写第一篇文章
            </Button>
          )}
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredPosts.map((post) => (
            <Grid item xs={12} md={6} lg={4} key={post.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardActionArea onClick={() => navigate(`/blog/${post.id}`)} sx={{ flex: 1 }}>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      {post.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        mb: 2,
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}
                    >
                      {post.summary || post.content.slice(0, 150)}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 1 }}>
                      {post.category && (
                        <Chip label={post.category} size="small" color="primary" />
                      )}
                      {post.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <CalendarToday sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(post.createdAt)}
                      </Typography>
                    </Box>
                  </CardContent>
                </CardActionArea>
                <Box sx={{ p: 1, display: 'flex', justifyContent: 'flex-end', gap: 0.5 }}>
                  <IconButton size="small" onClick={() => navigate(`/blog/edit/${post.id}`)}>
                    <Edit fontSize="small" />
                  </IconButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => {
                      setDeletingId(post.id)
                      setDeleteDialogOpen(true)
                    }}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 删除确认弹窗 */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>确认删除</DialogTitle>
        <DialogContent>
          <Typography>确定要删除这篇文章吗？此操作不可恢复。</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
          <Button variant="contained" color="error" onClick={handleDelete}>
            删除
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
