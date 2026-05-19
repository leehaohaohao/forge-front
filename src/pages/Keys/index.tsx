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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
} from '@mui/material'
import { Add, ContentCopy, Visibility, VisibilityOff, Delete, Edit, VpnKey } from '@mui/icons-material'
import { useKeysStore } from '../../stores'
import type { ApiKey } from '../../types'

export default function Keys() {
  const { keys, providers, addKey, updateKey, deleteKey } = useKeysStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [selectedKey, setSelectedKey] = useState<ApiKey | null>(null)
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [editingKey, setEditingKey] = useState<ApiKey | null>(null)
  const [form, setForm] = useState({ provider: '', name: '', key: '', description: '', quota: '' })
  const [copied, setCopied] = useState<string | null>(null)

  const maskKey = (key: string) => {
    if (key.length <= 8) return '****'
    return key.slice(0, 4) + '****' + key.slice(-4)
  }

  const handleCopy = (key: string, id: string) => {
    navigator.clipboard.writeText(key)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleShowKey = (key: ApiKey) => {
    setSelectedKey(key)
    setConfirmDialogOpen(true)
  }

  const confirmShowKey = () => {
    if (selectedKey) {
      setVisibleKeys((prev) => new Set([...prev, selectedKey.id]))
    }
    setConfirmDialogOpen(false)
  }

  const openAddDialog = () => {
    setEditingKey(null)
    setForm({ provider: providers[0]?.id || '', name: '', key: '', description: '', quota: '' })
    setDialogOpen(true)
  }

  const openEditDialog = (key: ApiKey) => {
    setEditingKey(key)
    setForm({
      provider: key.provider,
      name: key.name,
      key: key.key,
      description: key.description,
      quota: key.quota,
    })
    setDialogOpen(true)
  }

  const handleSave = () => {
    if (!form.key || !form.name) return
    if (editingKey) {
      updateKey(editingKey.id, { ...form })
    } else {
      addKey({
        ...form,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
      })
    }
    setDialogOpen(false)
  }

  const getProviderName = (id: string) => providers.find((p) => p.id === id)?.name || id
  const getProviderIcon = (id: string) => providers.find((p) => p.id === id)?.icon || '🔑'

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          AI 密钥管理
        </Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openAddDialog}>
          添加密钥
        </Button>
      </Box>

      {keys.length === 0 ? (
        <Card sx={{ p: 6, textAlign: 'center' }}>
          <VpnKey sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary">
            还没有保存任何密钥
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            点击上方按钮添加你的第一个 API 密钥
          </Typography>
          <Button variant="outlined" startIcon={<Add />} onClick={openAddDialog}>
            添加密钥
          </Button>
        </Card>
      ) : (
        <TableContainer component={Paper} sx={{ bgcolor: 'background.paper' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>厂商</TableCell>
                <TableCell>名称</TableCell>
                <TableCell>密钥</TableCell>
                <TableCell>描述</TableCell>
                <TableCell>额度</TableCell>
                <TableCell align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} hover>
                  <TableCell>
                    <Chip
                      icon={<span style={{ fontSize: 16 }}>{getProviderIcon(key.provider)}</span>}
                      label={getProviderName(key.provider)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{key.name}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                        {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                      </Typography>
                      <Tooltip title={visibleKeys.has(key.id) ? '隐藏' : '显示'}>
                        <IconButton size="small" onClick={() => handleShowKey(key)}>
                          {visibleKeys.has(key.id) ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={copied === key.id ? '已复制!' : '复制'}>
                        <IconButton size="small" onClick={() => handleCopy(key.key, key.id)}>
                          <ContentCopy fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {key.description || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{key.quota || '-'}</TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => openEditDialog(key)}>
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="error" onClick={() => deleteKey(key.id)}>
                      <Delete fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 二次确认弹窗 */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>安全确认</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            显示完整密钥可能会暴露你的 API 凭证，请确保周围环境安全。
          </Alert>
          <Typography>确定要显示完整密钥吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>取消</Button>
          <Button variant="contained" color="warning" onClick={confirmShowKey}>
            确认显示
          </Button>
        </DialogActions>
      </Dialog>

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingKey ? '编辑密钥' : '添加密钥'}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>AI 厂商</InputLabel>
            <Select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              label="AI 厂商"
            >
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>
                  {p.icon} {p.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            fullWidth
            label="名称/备注"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            margin="normal"
            placeholder="例如：GPT-4 工作用途"
          />
          <TextField
            fullWidth
            label="API Key"
            value={form.key}
            onChange={(e) => setForm({ ...form, key: e.target.value })}
            margin="normal"
            type="password"
          />
          <TextField
            fullWidth
            label="用途描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            margin="normal"
            multiline
            rows={2}
          />
          <TextField
            fullWidth
            label="额度信息"
            value={form.quota}
            onChange={(e) => setForm({ ...form, quota: e.target.value })}
            margin="normal"
            placeholder="例如：$50/月"
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
