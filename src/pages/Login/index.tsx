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

export default function Login() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!username || !password) {
      setError('请填写用户名和密码')
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
          Pocket Workbench
        </Typography>
        <Typography variant="caption" align="center" color="text.secondary" display="block" sx={{ mb: 2 }}>
          你的个人工作台
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 1.5, fontSize: 13 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit}>
          <TextField fullWidth label="用户名" value={username} onChange={(e) => setUsername(e.target.value)} margin="dense" size="small" autoFocus />
          <TextField fullWidth label="密码" type="password" value={password} onChange={(e) => setPassword(e.target.value)} margin="dense" size="small" />
          <Button type="submit" fullWidth variant="contained" sx={{ mt: 1.5, mb: 1.5 }} size="medium">
            登录
          </Button>
          <Typography variant="caption" align="center" display="block">
            还没有账号？{' '}
            <Link component={RouterLink} to="/register" sx={{ fontSize: 'inherit' }}>
              注册
            </Link>
          </Typography>
        </Box>
      </Paper>
    </Box>
  )
}
