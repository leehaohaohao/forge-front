import { useParams, useNavigate } from 'react-router-dom'
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Paper,
  Button,
} from '@mui/material'
import { ArrowBack, Edit, CalendarToday } from '@mui/icons-material'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useBlogStore } from '../../stores'

export default function BlogDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { posts } = useBlogStore()

  const post = posts.find((p) => p.id === id)

  if (!post) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">
          文章不存在
        </Typography>
        <Button onClick={() => navigate('/blog')} sx={{ mt: 2 }}>
          返回列表
        </Button>
      </Box>
    )
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <IconButton onClick={() => navigate('/blog')}>
          <ArrowBack />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Button
          variant="outlined"
          startIcon={<Edit />}
          onClick={() => navigate(`/blog/edit/${post.id}`)}
        >
          编辑
        </Button>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 4 }, maxWidth: 800, mx: 'auto' }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 700 }}>
          {post.title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <CalendarToday sx={{ fontSize: 16, color: 'text.secondary' }} />
            <Typography variant="body2" color="text.secondary">
              {formatDate(post.createdAt)}
            </Typography>
          </Box>
          {post.category && <Chip label={post.category} size="small" color="primary" />}
          {post.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" variant="outlined" />
          ))}
        </Box>

        {post.summary && (
          <Paper
            sx={{
              p: 2,
              mb: 3,
              bgcolor: 'action.hover',
              borderLeft: '4px solid',
              borderColor: 'primary.main',
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {post.summary}
            </Typography>
          </Paper>
        )}

        <Box
          sx={{
            '& h1, & h2, & h3, & h4, & h5, & h6': {
              mt: 3,
              mb: 1,
              fontWeight: 600,
            },
            '& h1': { fontSize: '2rem' },
            '& h2': { fontSize: '1.5rem' },
            '& h3': { fontSize: '1.25rem' },
            '& p': { mb: 2, lineHeight: 1.8 },
            '& code': {
              bgcolor: 'action.hover',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontFamily: 'monospace',
              fontSize: '0.9em',
            },
            '& pre': {
              bgcolor: 'rgba(0,0,0,0.3)',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              '& code': {
                bgcolor: 'transparent',
                p: 0,
              },
            },
            '& blockquote': {
              borderLeft: '4px solid',
              borderColor: 'primary.main',
              pl: 2,
              ml: 0,
              my: 2,
              color: 'text.secondary',
            },
            '& img': {
              maxWidth: '100%',
              borderRadius: 1,
            },
            '& a': {
              color: 'primary.main',
            },
            '& table': {
              borderCollapse: 'collapse',
              width: '100%',
              mb: 2,
              '& th, & td': {
                border: '1px solid',
                borderColor: 'divider',
                px: 1.5,
                py: 1,
              },
              '& th': {
                bgcolor: 'action.hover',
                fontWeight: 600,
              },
            },
            '& ul, & ol': {
              pl: 3,
              mb: 2,
              '& li': {
                mb: 0.5,
                lineHeight: 1.8,
              },
            },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </Box>
      </Paper>
    </Box>
  )
}
