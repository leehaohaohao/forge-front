import { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
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
  const [expandedId, setExpandedId] = useState<string | null>(null)

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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          碎片信息
        </Typography>
        <Button variant="contained" size="small" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={openAddDialog}>
          新建
        </Button>
      </Box>

      {/* 搜索和筛选 */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="搜索..."
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

      {filteredSnippets.length === 0 ? (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Code sx={{ fontSize: 32, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            {snippets.length === 0 ? '还没有保存任何碎片信息' : '没有匹配的结果'}
          </Typography>
          {snippets.length === 0 && (
            <Button variant="outlined" size="small" startIcon={<Add />} onClick={openAddDialog} sx={{ mt: 1 }}>
              新建
            </Button>
          )}
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 1, width: 24 }}> </TableCell>
                <TableCell sx={{ py: 1 }}>标题</TableCell>
                <TableCell sx={{ py: 1 }}>语言</TableCell>
                <TableCell sx={{ py: 1 }}>标签</TableCell>
                <TableCell sx={{ py: 1 }}>更新时间</TableCell>
                <TableCell sx={{ py: 1 }} align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSnippets.map((snippet) => (
                <>
                  <TableRow
                    key={snippet.id}
                    hover
                    sx={{ cursor: 'pointer' }}
                    onClick={() => setExpandedId(expandedId === snippet.id ? null : snippet.id)}
                  >
                    <TableCell sx={{ py: 0.75 }}>
                      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'monospace' }}>
                        {snippet.content.split('\n').length}L
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ py: 0.75, fontSize: 13, fontWeight: 500 }}>{snippet.title}</TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Chip label={snippet.language} size="small" variant="outlined" sx={{ height: 20, fontSize: 11 }} />
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }}>
                      <Box sx={{ display: 'flex', gap: 0.25, flexWrap: 'wrap' }}>
                        {snippet.tags.map((tag) => (
                          <Chip key={tag} label={tag} size="small" sx={{ height: 20, fontSize: 11 }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell sx={{ py: 0.75, fontSize: 12, color: 'text.secondary' }}>
                      {formatDate(snippet.updatedAt)}
                    </TableCell>
                    <TableCell sx={{ py: 0.75 }} align="right">
                      <Tooltip title="复制">
                        <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); handleCopy(snippet.content, snippet.id) }}>
                          <ContentCopy sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                      <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); openEditDialog(snippet) }}>
                        <Edit sx={{ fontSize: 14 }} />
                      </IconButton>
                      <IconButton size="small" sx={{ p: 0.25 }} color="error" onClick={(e) => { e.stopPropagation(); deleteSnippet(snippet.id) }}>
                        <Delete sx={{ fontSize: 14 }} />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                  {expandedId === snippet.id && (
                    <TableRow key={`${snippet.id}-detail`}>
                      <TableCell colSpan={6} sx={{ py: 0, bgcolor: 'rgba(0,0,0,0.15)' }}>
                        <Box
                          component="pre"
                          sx={{
                            m: 0,
                            p: 1.5,
                            fontFamily: 'monospace',
                            fontSize: 12,
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-all',
                            maxHeight: 240,
                            overflow: 'auto',
                          }}
                        >
                          {snippet.content}
                        </Box>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{editingSnippet ? '编辑碎片' : '新建碎片'}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField fullWidth label="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} margin="dense" size="small" />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl fullWidth margin="dense" size="small">
              <InputLabel>语言</InputLabel>
              <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} label="语言">
                {languages.map((lang) => (
                  <MenuItem key={lang} value={lang}>{lang}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField fullWidth label="标签（逗号分隔）" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} margin="dense" size="small" placeholder="config, docker" />
          </Box>
          <TextField
            fullWidth
            label="内容"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            margin="dense"
            size="small"
            multiline
            rows={14}
            sx={{ '& textarea': { fontFamily: 'monospace', fontSize: 13 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" onClick={handleSave} size="small">保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
