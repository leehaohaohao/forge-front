import { useState } from 'react'
import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  useMediaQuery,
  useTheme,
} from '@mui/material'
import {
  Menu as MenuIcon,
  Explore,
  Article,
  Key,
  Code,
  Logout,
  Person,
} from '@mui/icons-material'
import { useAuthStore } from '../../stores'

const drawerWidth = 200

const menuItems = [
  { text: '导航', icon: <Explore fontSize="small" />, path: '/navigation' },
  { text: '博客', icon: <Article fontSize="small" />, path: '/blog' },
  { text: '密钥管理', icon: <Key fontSize="small" />, path: '/keys' },
  { text: '碎片信息', icon: <Code fontSize="small" />, path: '/snippets' },
]

export default function Layout() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [mobileOpen, setMobileOpen] = useState(false)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen)
  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget)
  const handleMenuClose = () => setAnchorEl(null)
  const handleLogout = () => { logout(); navigate('/login') }

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ minHeight: '48px !important', px: 2 }}>
        <Typography variant="body1" noWrap sx={{ fontWeight: 700, fontSize: 15 }}>
          Pocket Workbench
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flex: 1, py: 0.5 }}>
        {menuItems.map((item) => (
          <ListItemButton
            key={item.path}
            selected={location.pathname.startsWith(item.path)}
            onClick={() => { navigate(item.path); if (isMobile) setMobileOpen(false) }}
            sx={{ borderRadius: 0.5, mx: 0.5, mb: 0.25, py: 0.5, minHeight: 36 }}
          >
            <ListItemIcon sx={{ minWidth: 32 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.text} primaryTypographyProps={{ fontSize: 14 }} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: 'background.paper',
          boxShadow: 'none',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: '48px !important' }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 1, display: { md: 'none' } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flex: 1 }} />
          <IconButton onClick={handleMenuOpen} sx={{ p: 0 }}>
            <Avatar sx={{ bgcolor: 'primary.main', width: 30, height: 30, fontSize: 14 }}>
              {user?.username?.[0]?.toUpperCase() || <Person sx={{ fontSize: 16 }} />}
            </Avatar>
          </IconButton>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}>
            <MenuItem disabled sx={{ fontSize: 13 }}>{user?.username}</MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ fontSize: 13 }}>
              <ListItemIcon><Logout fontSize="small" /></ListItemIcon>
              退出登录
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: 'none', md: 'block' }, '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 2, width: { md: `calc(100% - ${drawerWidth}px)` }, mt: '48px' }}>
        <Outlet />
      </Box>
    </Box>
  )
}
