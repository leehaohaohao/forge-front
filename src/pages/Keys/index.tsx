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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  Chip,
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          AI 密钥管理
        </Typography>
        <Button variant="contained" size="small" startIcon={<Add sx={{ fontSize: 16 }} />} onClick={openAddDialog}>
          添加密钥
        </Button>
      </Box>

      {keys.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <VpnKey sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            还没有保存任何密钥
          </Typography>
          <Button variant="outlined" size="small" startIcon={<Add />} onClick={openAddDialog} sx={{ mt: 1.5 }}>
            添加密钥
          </Button>
        </Paper>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ py: 1 }}>厂商</TableCell>
                <TableCell sx={{ py: 1 }}>名称</TableCell>
                <TableCell sx={{ py: 1 }}>密钥</TableCell>
                <TableCell sx={{ py: 1 }}>用途</TableCell>
                <TableCell sx={{ py: 1 }}>额度</TableCell>
                <TableCell sx={{ py: 1 }} align="right">操作</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {keys.map((key) => (
                <TableRow key={key.id} hover>
                  <TableCell sx={{ py: 0.75 }}>
                    <Chip label={getProviderName(key.provider)} size="small" variant="outlined" sx={{ height: 22, fontSize: 12 }} />
                  </TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 13 }}>{key.name}</TableCell>
                  <TableCell sx={{ py: 0.75 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: 12 }}>
                        {visibleKeys.has(key.id) ? key.key : maskKey(key.key)}
                      </Typography>
                      <Tooltip title={visibleKeys.has(key.id) ? '隐藏' : '显示'}>
                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => handleShowKey(key)}>
                          {visibleKeys.has(key.id) ? <VisibilityOff sx={{ fontSize: 14 }} /> : <Visibility sx={{ fontSize: 14 }} />}
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={copied === key.id ? '已复制' : '复制'}>
                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => handleCopy(key.key, key.id)}>
                          <ContentCopy sx={{ fontSize: 14 }} />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12, color: 'text.secondary' }}>{key.description || '-'}</TableCell>
                  <TableCell sx={{ py: 0.75, fontSize: 12 }}>{key.quota || '-'}</TableCell>
                  <TableCell sx={{ py: 0.75 }} align="right">
                    <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openEditDialog(key)}>
                      <Edit sx={{ fontSize: 14 }} />
                    </IconButton>
                    <IconButton size="small" sx={{ p: 0.25 }} color="error" onClick={() => deleteKey(key.id)}>
                      <Delete sx={{ fontSize: 14 }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* 二次确认弹窗 */}
      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)} maxWidth="xs">
        <DialogTitle sx={{ pb: 1 }}>安全确认</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Alert severity="warning" sx={{ mb: 1, fontSize: 13 }}>
            显示完整密钥可能暴露你的 API 凭证
          </Alert>
          <Typography variant="body2">确定要显示完整密钥吗？</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" color="warning" onClick={confirmShowKey} size="small">确认</Button>
        </DialogActions>
      </Dialog>

      {/* 添加/编辑弹窗 */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pb: 1 }}>{editingKey ? '编辑密钥' : '添加密钥'}</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <FormControl fullWidth margin="dense" size="small">
            <InputLabel>AI 厂商</InputLabel>
            <Select value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })} label="AI 厂商">
              {providers.map((p) => (
                <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField fullWidth label="名称/备注" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} margin="dense" size="small" placeholder="如：GPT-4 工作用途" />
          <TextField fullWidth label="API Key" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} margin="dense" size="small" type="password" />
          <TextField fullWidth label="用途描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} margin="dense" size="small" />
          <TextField fullWidth label="额度信息" value={form.quota} onChange={(e) => setForm({ ...form, quota: e.target.value })} margin="dense" size="small" placeholder="如：$50/月" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} size="small">取消</Button>
          <Button variant="contained" onClick={handleSave} size="small">保存</Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
