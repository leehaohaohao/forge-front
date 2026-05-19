import { useState } from 'react'
import {
  Box,
  TextField,
  InputAdornment,
  IconButton,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  Grid,
  Chip,
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
} from '@mui/material'
import {
  Search,
  Add,
  Delete,
  Edit,
  OpenInNew,
} from '@mui/icons-material'
import { useNavStore } from '../../stores'
import type { NavSite, NavCategory } from '../../types'

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
    setSiteForm({ name: '', url: '', icon: '🔗', description: '', categoryId: categoryId || categories[0]?.id || '' })
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

  const handleDeleteSite = (siteId: string) => {
    deleteSite(siteId)
  }

  const handleAddCategory = () => {
    if (!categoryForm.name) return
    addCategory({
      id: Date.now().toString(),
      name: categoryForm.name,
      icon: categoryForm.icon || '📁',
      sites: [],
    })
    setCategoryDialogOpen(false)
    setCategoryForm({ name: '', icon: '' })
  }

  return (
    <Box sx={{ background, minHeight: 'calc(100vh - 64px - 48px)', borderRadius: 2, p: 3 }}>
      {/* 搜索框 */}
      <Box sx={{ maxWidth: 600, mx: 'auto', mb: 4, pt: 4 }}>
        <TextField
          fullWidth
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          placeholder="搜索..."
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FormControl size="small" sx={{ minWidth: 80 }}>
                  <Select
                    value={currentEngine.id}
                    onChange={(e) => {
                      const engine = searchEngines.find((eng) => eng.id === e.target.value)
                      if (engine) setCurrentEngine(engine)
                    }}
                    variant="standard"
                    disableUnderline
                  >
                    {searchEngines.map((eng) => (
                      <MenuItem key={eng.id} value={eng.id}>
                        {eng.icon} {eng.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <IconButton onClick={handleSearch}>
                  <Search />
                </IconButton>
              </InputAdornment>
            ),
          }}
          sx={{
            '& .MuiOutlinedInput-root': {
              bgcolor: 'rgba(255,255,255,0.1)',
              backdropFilter: 'blur(10px)',
              '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' },
            },
          }}
        />
      </Box>

      {/* 分类和网站 */}
      {categories.map((category) => (
        <Box key={category.id} sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ color: 'white', fontWeight: 600 }}>
              {category.icon} {category.name}
            </Typography>
            <Tooltip title="添加网站">
              <IconButton
                size="small"
                sx={{ ml: 1, color: 'rgba(255,255,255,0.7)' }}
                onClick={() => openAddSiteDialog(category.id)}
              >
                <Add fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Grid container spacing={2}>
            {category.sites.map((site) => (
              <Grid item xs={6} sm={4} md={3} lg={2} key={site.id}>
                <Card
                  sx={{
                    bgcolor: 'rgba(255,255,255,0.1)',
                    backdropFilter: 'blur(10px)',
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.18)', transform: 'translateY(-2px)' },
                    transition: 'all 0.2s',
                    position: 'relative',
                  }}
                >
                  <CardActionArea
                    onClick={() => window.open(site.url, '_blank')}
                    sx={{ p: 2, textAlign: 'center' }}
                  >
                    <Typography variant="h4" sx={{ mb: 1 }}>
                      {site.icon}
                    </Typography>
                    <Typography variant="body2" sx={{ color: 'white', fontWeight: 500 }}>
                      {site.name}
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.6)' }}>
                      {site.description}
                    </Typography>
                  </CardActionArea>
                  <Box sx={{ position: 'absolute', top: 4, right: 4, display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: 'white' } }}
                      onClick={(e) => {
                        e.stopPropagation()
                        openEditSiteDialog(site)
                      }}
                    >
                      <Edit fontSize="inherit" />
                    </IconButton>
                    <IconButton
                      size="small"
                      sx={{ color: 'rgba(255,255,255,0.5)', '&:hover': { color: '#f44336' } }}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteSite(site.id)
                      }}
                    >
                      <Delete fontSize="inherit" />
                    </IconButton>
                  </Box>
                </Card>
              </Grid>
            ))}
            {/* 添加按钮 */}
            <Grid item xs={6} sm={4} md={3} lg={2}>
              <Card
                sx={{
                  bgcolor: 'rgba(255,255,255,0.05)',
                  border: '2px dashed rgba(255,255,255,0.2)',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.1)', borderColor: 'rgba(255,255,255,0.4)' },
                  transition: 'all 0.2s',
                }}
              >
                <CardActionArea onClick={() => openAddSiteDialog(category.id)} sx={{ p: 2, textAlign: 'center' }}>
                  <Add sx={{ fontSize: 40, color: 'rgba(255,255,255,0.4)', mb: 1 }} />
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                    添加网站
                  </Typography>
                </CardActionArea>
              </Card>
            </Grid>
          </Grid>
        </Box>
      ))}

      {/* 添加分类 */}
      <Button
        startIcon={<Add />}
        sx={{ color: 'rgba(255,255,255,0.7)', mt: 2 }}
        onClick={() => setCategoryDialogOpen(true)}
      >
        添加分类
      </Button>

      {/* 网站编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSite ? '编辑网站' : '添加网站'}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="名称"
            value={siteForm.name}
            onChange={(e) => setSiteForm({ ...siteForm, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="URL"
            value={siteForm.url}
            onChange={(e) => setSiteForm({ ...siteForm, url: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="图标（Emoji）"
            value={siteForm.icon}
            onChange={(e) => setSiteForm({ ...siteForm, icon: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="描述"
            value={siteForm.description}
            onChange={(e) => setSiteForm({ ...siteForm, description: e.target.value })}
            margin="normal"
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>分类</InputLabel>
            <Select
              value={siteForm.categoryId}
              onChange={(e) => setSiteForm({ ...siteForm, categoryId: e.target.value })}
              label="分类"
            >
              {categories.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleSaveSite}>
            保存
          </Button>
        </DialogActions>
      </Dialog>

      {/* 分类编辑弹窗 */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>添加分类</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="分类名称"
            value={categoryForm.name}
            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
            margin="normal"
          />
          <TextField
            fullWidth
            label="图标（Emoji）"
            value={categoryForm.icon}
            onChange={(e) => setCategoryForm({ ...categoryForm, icon: e.target.value })}
            margin="normal"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>取消</Button>
          <Button variant="contained" onClick={handleAddCategory}>
            添加
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
