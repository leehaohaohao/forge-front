import { useParams, useNavigate } from 'react-router-dom'
import { Box, Typography, Chip, IconButton, Paper, Button } from '@mui/material'
import { ArrowBack, Edit } from '@mui/icons-material'
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
      <Box sx={{ textAlign: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">文章不存在</Typography>
        <Button size="small" onClick={() => navigate('/blog')} sx={{ mt: 1 }}>返回列表</Button>
      </Box>
    )
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <IconButton onClick={() => navigate('/blog')} size="small">
          <ArrowBack fontSize="small" />
        </IconButton>
        <Box sx={{ flex: 1 }} />
        <Button variant="outlined" size="small" startIcon={<Edit sx={{ fontSize: 14 }} />} onClick={() => navigate(`/blog/edit/${post.id}`)}>
          编辑
        </Button>
      </Box>

      <Paper sx={{ p: { xs: 2, md: 3 }, maxWidth: 780, mx: 'auto' }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
          {post.title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {formatDate(post.createdAt)}
          </Typography>
          {post.category && <Chip label={post.category} size="small" color="primary" sx={{ height: 20, fontSize: 11 }} />}
          {post.tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" sx={{ height: 20, fontSize: 11 }} />
          ))}
        </Box>

        {post.summary && (
          <Box sx={{ p: 1.5, mb: 2, bgcolor: 'action.hover', borderLeft: '3px solid', borderColor: 'primary.main' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: 13 }}>
              {post.summary}
            </Typography>
          </Box>
        )}

        <Box
          sx={{
            '& h1, & h2, & h3, & h4, & h5, & h6': { mt: 2, mb: 0.5, fontWeight: 600 },
            '& h1': { fontSize: '1.5rem' },
            '& h2': { fontSize: '1.25rem' },
            '& h3': { fontSize: '1.1rem' },
            '& p': { mb: 1.5, lineHeight: 1.7, fontSize: 14 },
            '& code': { bgcolor: 'action.hover', px: 0.5, py: 0.25, borderRadius: 0.5, fontFamily: 'monospace', fontSize: '0.85em' },
            '& pre': { bgcolor: 'rgba(0,0,0,0.3)', p: 1.5, borderRadius: 1, overflow: 'auto', '& code': { bgcolor: 'transparent', p: 0 } },
            '& blockquote': { borderLeft: '3px solid', borderColor: 'primary.main', pl: 2, ml: 0, my: 1.5, color: 'text.secondary' },
            '& img': { maxWidth: '100%', borderRadius: 1 },
            '& a': { color: 'primary.main' },
            '& table': { borderCollapse: 'collapse', width: '100%', mb: 2, '& th, & td': { border: '1px solid', borderColor: 'divider', px: 1, py: 0.5 }, '& th': { bgcolor: 'action.hover', fontWeight: 600 } },
            '& ul, & ol': { pl: 3, mb: 1.5, '& li': { mb: 0.25, lineHeight: 1.7 } },
          }}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{post.content}</ReactMarkdown>
        </Box>
      </Paper>
    </Box>
  )
}
