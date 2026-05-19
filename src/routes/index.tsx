import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../stores'
import Layout from '../components/Layout'
import Login from '../pages/Login'
import Register from '../pages/Register'
import Navigation from '../pages/Navigation'
import BlogList from '../pages/Blog/BlogList'
import BlogEditor from '../pages/Blog/BlogEditor'
import BlogDetail from '../pages/Blog/BlogDetail'
import Keys from '../pages/Keys'
import Snippets from '../pages/Snippets'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <>{children}</>
}

export const routes = [
  { path: '/login', element: <Login /> },
  { path: '/register', element: <Register /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <Layout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/navigation" replace /> },
      { path: 'navigation', element: <Navigation /> },
      { path: 'blog', element: <BlogList /> },
      { path: 'blog/new', element: <BlogEditor /> },
      { path: 'blog/edit/:id', element: <BlogEditor /> },
      { path: 'blog/:id', element: <BlogDetail /> },
      { path: 'keys', element: <Keys /> },
      { path: 'snippets', element: <Snippets /> },
    ],
  },
]
