import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Grid,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material'
import { Add, Delete, Edit, Search, Code, ContentCopy } from '@mui/icons-material'
import { useSnippetStore } from '../../stores'
import type { Snippet } from '../../types'

const languages = [
  'plaintext', 'javascript', 'typescript', 'python', 'java', 'go',
  'rust', 'sql', 'json', 'yaml', 'xml', 'bash', 'css', 'html', 'other'
]

export default function Snippets() {
  const { snippets, addSnippet, updateSnippet, deleteSnippet } = useSnippetStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSnippet, setEditingSnippet] = useState<Snippet | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTag, setFilterTag] = useState('')
  const [form, setForm] = useState({ title: '', content: '', language: 'plaintext', tags: '' })
  const [copied, setCopied] = useState<string | null>(null)

  const allTags = [...new Set(snippets.flatMap((s) => s.tags))]

  const filteredSnippets = snippets.filter((s) => {
    const matchSearch = !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase()) || s.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchTag = !filterTag || s.tags.includes(filterTag)
    return matchSearch && matchTag
  })

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const openAddDialog = () => {
    setEditingSnippet(null)
    setForm({ title: '', content: '', language: 'plaintext', tags: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (snippet: Snippet) => {
    setEditingSnippet(snippet)
    setForm({
      title: snippet.title,
      content: snippet.content,
      language: snippet.language,
      tags: snippet.tags.join(', '),
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.title || !form.content) return
    const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean)
    if (editingSnippet) {
      updateSnippet(editingSnippet.id, { ...form, tags })
    } else {
      addSnippet({
        ...form,
        tags,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    setDialogOpen(false)
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          碎片信息
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAddDialog}>
          新建碎片
        </Button>
      </Box>

      {/* 搜索和筛选 */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField
          size="small"
          placeholder="搜索..."
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

      {filteredSnippets.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <Code sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            {snippets.length === 0 ? '还没有保存任何碎片信息' : '没有匹配的结果'}
          </Typography>
          {snippets.length === 0 && (
            <Button variant="outlined" startIcon={<Add />} onClick={openAddDialog} sx={{ mt: 2 }}>
              新建碎片
            </Button>
          )}
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredSnippets.map((snippet) => (
            <Grid item xs={12} md={6} lg={4} key={snippet.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      {snippet.title}
                    </Typography>
                    <Box>
                      <IconButton size="small" onClick={() => handleCopy(snippet.content, snippet.id)}>
                        <ContentCopy fontSize="small" />
                      </IconButton>
                      <IconButton size="small" onClick={() => openEditDialog(snippet)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => deleteSnippet(snippet.id)}>
                        <Delete fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      bgcolor: 'rgba(0,0,0,0.3)',
                      borderRadius: 1,
                      p: 1.5,
                      mb: 1,
                      maxHeight: 200,
                      overflow: 'auto',
                    }}
                  >
                    <Typography
                      variant="body2"
                      component="pre"
                      sx={{
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        m: 0,
                        fontSize: 12,
                      }}
                    >
                      {snippet.content}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                    <Chip label={snippet.language} size="small" color="primary" variant="outlined" />
                    {snippet.tags.map((tag) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" />
                    ))}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editingSnippet ? '编辑碎片' : '新建碎片'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="标题"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            margin="normal"
          />
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>语言</InputLabel>
              <Select
                value={form.language}
                onChange={(e) => setForm({ ...form, language: e.target.value })}
                label="语言"
              >
                {languages.map((lang) => (
                  <MenuItem key={lang} value={lang}>
                    {lang}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              fullWidth
              label="标签（逗号分隔）"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              margin="normal"
              placeholder="config, docker, snippet"
            />
          </Box>
          <TextField
            fullWidth
            label="内容"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            margin="normal"
            multiline
            rows={12}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 14 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSave}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
