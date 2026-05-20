import { useState } from 'react'
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material'
import { Search, Add, Delete, Edit, OpenInNew, FolderOpen } from '@mui/icons-material'
import { useNavStore } from '../../stores'
import type { NavSite } from '../../types'

export default function Navigation() {
  const {
    categories,
    searchEngines,
    currentEngine,
    background,
    setCurrentEngine,
    addSite,
    updateSite,
    deleteSite,
    addCategory,
  } = useNavStore()

  const [searchQuery, setSearchQuery] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false)
  const [editingSite, setEditingSite] = useState<NavSite | null>(null)
  const [siteForm, setSiteForm] = useState({ name: '', url: '', icon: '', description: '', categoryId: '' })
  const [categoryForm, setCategoryForm] = useState({ name: '', icon: '' })

  const handleSearch = () => {
    if (searchQuery.trim()) {
      window.open(currentEngine.url + encodeURIComponent(searchQuery), '_blank')
    }
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

  const openAddSiteDialog = (categoryId?: string) => {
    setEditingSite(null)
    setSiteForm({ name: '', url: '', icon: '', description: '', categoryId: categoryId || categories[0]?.id || '' })
    setDialogOpen(true)
  }

  const openEditSiteDialog = (site: NavSite) => {
    setEditingSite(site)
    setSiteForm({
      name: site.name,
      url: site.url,
      icon: site.icon,
      description: site.description,
      categoryId: site.categoryId,
    })
    setDialogOpen(true)
  }

  const handleSaveSite = () => {
    if (!siteForm.name || !siteForm.url) return
    if (editingSite) {
      updateSite(editingSite.id, siteForm)
    } else {
      addSite(siteForm.categoryId, {
        ...siteForm,
        id: Date.now().toString(),
      })
    }
    setDialogOpen(false)
  }

  const handleAddCategory = () => {
    if (!categoryForm.name) return
    addCategory({
      id: Date.now().toString(),
      name: categoryForm.name,
      icon: categoryForm.icon || 'Folder',
      sites: [],
    })
    setCategoryDialogOpen(false)
    setCategoryForm({ name: '', icon: '' })
  }

  return (
    <Box sx={{ background, minHeight: 'calc(100vh - 64px - 48px)', borderRadius: 1, p: 2 }}>
      {/* 搜索框 */}
      <Box sx={{ maxWidth: 560, mx: 'auto', mb: 3, pt: 2 }}>
        <Paper sx={{ display: 'flex', alignItems: 'center', px: 1 }}>
          <FormControl size="small" sx={{ minWidth: 72 }}>
            <Select
              value={currentEngine.id}
              onChange={(e) => {
                const engine = searchEngines.find((eng) => eng.id === e.target.value)
                if (engine) setCurrentEngine(engine)
              }}
              variant="standard"
              disableUnderline
              sx={{ fontSize: 13 }}
            >
              {searchEngines.map((eng) => (
                <MenuItem key={eng.id} value={eng.id} sx={{ fontSize: 13 }}>
                  {eng.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
          <TextField
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="输入关键词搜索..."
            variant="standard"
            disableUnderline
            InputProps={{
              sx: { fontSize: 14, py: 0.5 },
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={handleSearch} size="small">
                    <Search fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Paper>
      </Box>

      {/* 分类和网站 */}
      {categories.map((category) => (
        <Box key={category.id} sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
            <FolderOpen sx={{ fontSize: 16, color: 'rgba(255,255,255,0.5)', mr: 0.5 }} />
            <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)', fontWeight: 600, fontSize: 13 }}>
              {category.name}
            </Typography>
            <Tooltip title="添加网站">
              <IconButton
                size="small"
                sx={{ ml: 0.5, color: 'rgba(255,255,255,0.4)', p: 0.25 }}
                onClick={() => openAddSiteDialog(category.id)}
              >
                <Add sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
            {category.sites.map((site) => (
              <Paper
                key={site.id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  px: 1.5,
                  py: 0.75,
                  bgcolor: 'rgba(255,255,255,0.08)',
                  cursor: 'pointer',
                  width: 170,
                  '&:hover': {
                    bgcolor: 'rgba(255,255,255,0.15)',
                    '& .site-actions': { opacity: 1 },
                  },
                  transition: 'all 0.15s',
                }}
                onClick={() => window.open(site.url, '_blank')}
              >
                <Box
                  sx={{
                    width: 28,
                    height: 28,
                    borderRadius: 0.5,
                    bgcolor: 'rgba(255,255,255,0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.7)',
                    flexShrink: 0,
                  }}
                >
                  {site.icon || site.name.slice(0, 2).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ color: '#fff', fontSize: 13, fontWeight: 500, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {site.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}>
                    {site.description}
                  </Typography>
                </Box>
                <Box
                  className="site-actions"
                  sx={{ display: 'flex', gap: 0.25, opacity: 0, transition: 'opacity 0.15s' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <IconButton
                    size="small"
                    sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
                    onClick={() => openEditSiteDialog(site)}
                  >
                    <Edit sx={{ fontSize: 12 }} />
                  </IconButton>
                  <IconButton
                    size="small"
                    sx={{ p: 0.25, color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#f44336' } }}
                    onClick={() => deleteSite(site.id)}
                  >
                    <Delete sx={{ fontSize: 12 }} />
                  </IconButton>
                </Box>
              </Paper>
            ))}
            {/* 添加按钮 */}
            <Paper
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.5,
                px: 1.5,
                py: 0.75,
                width: 170,
                border: '1px dashed rgba(255,255,255,0.15)',
                bgcolor: 'transparent',
                cursor: 'pointer',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.05)', borderColor: 'rgba(255,255,255,0.3)' },
                transition: 'all 0.15s',
              }}
              onClick={() => openAddSiteDialog(category.id)}
            >
              <Add sx={{ fontSize: 14, color: 'rgba(255,255,255,0.3)' }} />
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
                添加
              </Typography>
            </Paper>
          </Box>
        </Box>
      ))}

      {/* 添加分类 */}
      <Button
        startIcon={<Add sx={{ fontSize: 14 }} />}
        size="small"
        sx={{ color: 'rgba(255,255,255,0.4)', mt: 1, fontSize: 12 }}
        onClick={() => setCategoryDialogOpen(true)}
      >
        添加分类
      </Button>

      {/* 网站编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{editingSite ? '编辑网站' : '添加网站'}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField fullWidth label="名称" value={siteForm.name} onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })} margin="dense" size="small" />
          <TextField fullWidth label="URL" value={siteForm.url} onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })} margin="dense" size="small" />
          <TextField fullWidth label="图标（缩写）" value={siteForm.icon} onChange={(e) => setSiteForm({ ...siteForm, icon: e.target.value })} margin="dense" size="small" placeholder="如 GH、GPT" />
          <TextField fullWidth label="描述" value={siteForm.description} onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })} margin="dense" size="small" />
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>分类</InputLabel>
            <Select value={siteForm.categoryId} onChange={(e) => setSiteForm({ ...siteForm, categoryId: e.target.value })} label="分类">
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" onClick={handleSaveSite} size="small">保存</Button>
        </DialogActions>
      </Dialog>

      {/* 分类编辑弹窗 */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>添加分类</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <TextField fullWidth label="分类名称" value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} margin="dense" size="small" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" onClick={handleAddCategory} size="small">添加</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
