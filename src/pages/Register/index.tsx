import { useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Link,
  Alert,
} from '@mui/material'
import { useAuthStore } from '../../stores'

export default function Register() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password || !inviteCode) {
      setError('请填写所有必填项')
      return
    }
    if (password !== confirmPassword) {
      setError('两次密码不一致')
      return
    }
    login({ id: '1', username, avatar: '' }, 'mock-token')
    navigate('/')
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
      }}
    >
      <Paper sx={{ width: 320, p: 3 }}>
        <Typography variant="h6" align="center" sx={{ fontWeight: 700, mb: 0.5 }}>
          注册账号
        </Typography>
        <Typography variant="caption" align="center" color="text.secondary" display="block" sx={{ mb: 2 }}>
          需要邀请码才能注册
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5, fontSize: 13 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} margin="dense" size="small" autoFocus />
          <TextField fullWidth label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} margin="dense" size="small" />
          <TextField fullWidth label="确认密码" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} margin="dense" size="small" />
          <TextField fullWidth label="邀请码" value={inviteCode} onChange={(e) => setInviteCode(e.target.value)} margin="dense" size="small" />
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 1.5, mb: 1.5 }} size="medium">
            注册
          </Button>
          <Typography variant="caption" align="center" display="block">
            已有账号？{' '}
            <Link component={RouterLink} to="/login" sx={{ fontSize: 'inherit' }}>
              登录
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
