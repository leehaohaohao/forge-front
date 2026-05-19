import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  TextField,
  Typography,
  Chip,
  Paper,
  IconButton,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { ArrowBack, Save, Visibility } from '@mui/icons-material'
import MDEditor from '@uiw/react-md-editor'
import { useBlogStore } from '../../stores'

export default function BlogEditor() {
  const navigate = useNavigate()
  const { id } = useParams()
  const { posts, addPost, updatePost } = useBlogStore()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [summary, setSummary] = useState('')
  const [category, setCategory] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [status, setStatus] = useState<'draft' | 'published'>('draft')

  useEffect(() => {
    if (id) {
      const post = posts.find((p) => p.id === id)
      if (post) {
        setTitle(post.title)
        setContent(post.content)
        setSummary(post.summary)
        setCategory(post.category)
        setTags(post.tags)
        setStatus(post.status)
      }
    }
  }, [id, posts])

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag])
    }
    setTagInput('')
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      handleAddTag()
    }
  }

  const handleSave = (saveStatus: 'draft' | 'published') => {
    if (!title || !content) return
    const now = new Date().toISOString()
    if (id) {
      updatePost(id, { title, content, summary, category, tags, status: saveStatus, updatedAt: now })
    } else {
      addPost({
        id: Date.now().toString(),
        title,
        content,
        summary,
        category,
        tags,
        status: saveStatus,
        createdAt: now,
        updatedAt: now,
      })
    }
    navigate('/blog')
  }

  return (
    <Box data-color-mode="dark">
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={() => navigate('/blog')}>
            <ArrowBack />
          </IconButton>
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            {id ? '编辑文章' : '写文章'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<Save />}
            onClick={() => handleSave('draft')}
          >
            保存草稿
          </Button>
          <Button
            variant="contained"
            startIcon={<Visibility />}
            onClick={() => handleSave('published')}
          >
            发布
          </Button>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* 编辑区域 */}
        <Box sx={{ flex: 1 }}>
          <TextField
            fullWidth
            label="文章标题"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="摘要"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            multiline
            rows={2}
            sx={{ mb: 2 }}
          />
          <Box sx={{ mb: 2 }}>
            <MDEditor
              value={content}
              onChange={(val) => setContent(val || '')}
              height={500}
            />
          </Box>
        </Box>

        {/* 侧边信息 */}
        <Box sx={{ width: { xs: '100%', md: 280 }, flexShrink: 0 }}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              分类
            </Typography>
            <TextField
              fullWidth
              size="small"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="例如：技术笔记"
            />
          </Paper>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              标签
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
              {tags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  onDelete={() => setTags(tags.filter((t) => t !== tag))}
                />
              ))}
            </Box>
            <TextField
              fullWidth
              size="small"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={handleAddTag}
              placeholder="输入标签，按回车添加"
            />
          </Paper>
        </Box>
      </Box>
    </Box>
  )
}
