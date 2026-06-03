'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { adminApi } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { getApiError, timeAgo } from '@/lib/utils';
import { Card, Button, Badge, Skeleton, Modal, Input } from '@/components/ui';
import {
  ArrowLeft, Plus, Pencil, Trash2, Eye, EyeOff, RefreshCw,
  FileText, Tag, Calendar, Globe,
} from 'lucide-react';
import type { BlogPost } from '@/types';
import toast from 'react-hot-toast';

const EMPTY_POST: Partial<BlogPost> = {
  slug:             '',
  title:            '',
  excerpt:          '',
  content:          '',
  author_name:      'Attenda Team',
  author_avatar:    '',
  cover_image:      '',
  tags:             [],
  meta_title:       '',
  meta_description: '',
  og_image:         '',
  is_published:     false,
  read_time_mins:   null,
};

export default function AdminBlogPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [posts, setPosts]       = useState<BlogPost[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState<Partial<BlogPost> | null>(null);
  const [isNew, setIsNew]       = useState(false);
  const [saving, setSaving]     = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [tagsInput, setTagsInput] = useState('');

  useEffect(() => {
    if (!authLoading && user && user.role !== 'platform_admin') router.replace('/dashboard');
    if (!authLoading && !user) router.replace('/login');
  }, [user, authLoading, router]);

  const loadPosts = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await adminApi.getBlogPosts({ page: p, limit: 20 });
      setPosts(res.data.data.posts);
      setTotal(res.data.data.total);
      setPage(p);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && user?.role === 'platform_admin') loadPosts();
  }, [authLoading, user, loadPosts]);

  const openNew = () => {
    setIsNew(true);
    setEditing({ ...EMPTY_POST });
    setTagsInput('');
  };

  const openEdit = (post: BlogPost) => {
    setIsNew(false);
    setEditing({ ...post });
    setTagsInput(post.tags.join(', '));
  };

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.slug?.trim())  { toast.error('Slug is required');  return; }
    if (!editing.title?.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    try {
      const data = {
        ...editing,
        tags: tagsInput.split(',').map(t => t.trim()).filter(Boolean),
      };
      if (isNew) {
        const res = await adminApi.createBlogPost(data);
        setPosts(prev => [res.data.data, ...prev]);
        setTotal(t => t + 1);
      } else {
        const res = await adminApi.updateBlogPost(editing.id!, data);
        setPosts(prev => prev.map(p => p.id === editing.id ? res.data.data : p));
      }
      toast.success(isNew ? 'Post created' : 'Post updated');
      setEditing(null);
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? This cannot be undone.')) return;
    setDeleting(id);
    try {
      await adminApi.deleteBlogPost(id);
      setPosts(prev => prev.filter(p => p.id !== id));
      setTotal(t => t - 1);
      toast.success('Post deleted');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setDeleting(null);
    }
  };

  const handleTogglePublish = async (post: BlogPost) => {
    setToggling(post.id);
    try {
      const res = await adminApi.togglePublish(post.id);
      setPosts(prev => prev.map(p => p.id === post.id ? res.data.data : p));
      toast.success(res.data.data.is_published ? 'Post published' : 'Post unpublished');
    } catch (err) {
      toast.error(getApiError(err));
    } finally {
      setToggling(null);
    }
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[var(--gray-50)] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[var(--primary-600)] border-t-transparent animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--gray-50)]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="p-2 rounded-lg hover:bg-[var(--gray-100)] transition-colors">
              <ArrowLeft size={18} className="text-[var(--gray-600)]" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-[var(--dark-950)]">Blog Management</h1>
              <p className="text-sm text-[var(--gray-500)]">{total} posts total</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={() => loadPosts(page)} loading={loading}>Refresh</Button>
            <Button size="sm" icon={<Plus size={14} />} onClick={openNew}>New Post</Button>
          </div>
        </div>

        <Card>
          {loading ? (
            <div className="p-5 space-y-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
          ) : posts.length === 0 ? (
            <div className="py-16 text-center">
              <FileText size={32} className="mx-auto mb-3 text-[var(--gray-300)]" />
              <p className="text-sm text-[var(--gray-500)]">No blog posts yet</p>
              <button onClick={openNew} className="mt-3 text-sm text-[var(--primary-600)] hover:underline">Create your first post</button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--gray-100)]">
              {posts.map(post => (
                <div key={post.id} className="flex items-start gap-4 px-5 py-4 hover:bg-[var(--gray-50)] transition-colors">
                  {post.cover_image ? (
                    <div className="w-16 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-[var(--gray-100)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={post.cover_image} alt="" className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div className="w-16 h-12 rounded-lg bg-[var(--gray-100)] flex items-center justify-center flex-shrink-0">
                      <FileText size={20} className="text-[var(--gray-400)]" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-[var(--dark-950)] truncate">{post.title}</p>
                      <Badge
                        label={post.is_published ? 'Published' : 'Draft'}
                        color={post.is_published ? 'var(--success-700)' : 'var(--gray-600)'}
                        bg={post.is_published ? 'var(--success-100)' : 'var(--gray-100)'}
                        size="sm"
                      />
                    </div>
                    <p className="text-xs text-[var(--gray-500)] truncate mb-1">{post.excerpt || 'No excerpt'}</p>
                    <div className="flex items-center gap-3 text-xs text-[var(--gray-400)]">
                      <span className="flex items-center gap-1"><Globe size={10} /> /{post.slug}</span>
                      {post.tags.length > 0 && <span className="flex items-center gap-1"><Tag size={10} /> {post.tags.slice(0, 3).join(', ')}</span>}
                      {post.read_time_mins && <span>{post.read_time_mins} min read</span>}
                      <span>{post.views} views</span>
                      <span>{timeAgo(post.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button onClick={() => handleTogglePublish(post)} disabled={toggling === post.id}
                      className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors"
                      title={post.is_published ? 'Unpublish' : 'Publish'}>
                      {post.is_published ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => openEdit(post)}
                      className="p-1.5 rounded-lg hover:bg-[var(--gray-100)] text-[var(--gray-500)] hover:text-[var(--dark-950)] transition-colors" title="Edit">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => handleDelete(post.id)} disabled={deleting === post.id}
                      className="p-1.5 rounded-lg hover:bg-[var(--danger-100)] text-[var(--gray-500)] hover:text-[var(--danger-700)] transition-colors" title="Delete">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* ─── Edit / Create Drawer ─── */}
      {editing !== null && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/30" onClick={() => setEditing(null)} />
          <div className="w-full max-w-xl bg-white h-full shadow-xl flex flex-col overflow-hidden slide-in-right">
            <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--gray-100)]">
              <h2 className="text-sm font-bold text-[var(--dark-950)]">{isNew ? 'New Post' : 'Edit Post'}</h2>
              <button onClick={() => setEditing(null)} className="p-1.5 rounded-lg hover:bg-[var(--gray-100)]">
                <span className="text-[var(--gray-500)] text-lg leading-none">×</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Tabs: Content / SEO */}
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Title</label>
                <input type="text" value={editing.title || ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
                  placeholder="Post title" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Slug</label>
                <input type="text" value={editing.slug || ''} onChange={e => setEditing(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                  placeholder="post-url-slug" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Excerpt</label>
                <textarea rows={2} value={editing.excerpt || ''} onChange={e => setEditing(p => ({ ...p, excerpt: e.target.value }))}
                  placeholder="Brief summary for listings and SEO..." className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] resize-none" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Content (Markdown)</label>
                <textarea rows={12} value={editing.content || ''} onChange={e => setEditing(p => ({ ...p, content: e.target.value }))}
                  placeholder="# Heading&#10;&#10;Your content here..." className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] resize-y" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Author Name</label>
                  <input type="text" value={editing.author_name || ''} onChange={e => setEditing(p => ({ ...p, author_name: e.target.value }))}
                    className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Read Time (mins)</label>
                  <input type="number" min="1" value={editing.read_time_mins ?? ''} onChange={e => setEditing(p => ({ ...p, read_time_mins: e.target.value ? Number(e.target.value) : null }))}
                    className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Cover Image URL</label>
                <input type="url" value={editing.cover_image || ''} onChange={e => setEditing(p => ({ ...p, cover_image: e.target.value }))}
                  placeholder="https://..." className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Tags (comma-separated)</label>
                <input type="text" value={tagsInput} onChange={e => setTagsInput(e.target.value)}
                  placeholder="HR, attendance, workforce management" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
              </div>

              <hr className="border-[var(--gray-100)]" />
              <p className="text-xs font-bold text-[var(--gray-500)] uppercase tracking-wide">SEO & Social</p>

              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Meta Title</label>
                <input type="text" value={editing.meta_title || ''} onChange={e => setEditing(p => ({ ...p, meta_title: e.target.value }))}
                  placeholder="Page title for search engines (50–60 chars)" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
                <p className="text-xs text-[var(--gray-400)] mt-1">{(editing.meta_title || '').length}/60 chars</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">Meta Description</label>
                <textarea rows={2} value={editing.meta_description || ''} onChange={e => setEditing(p => ({ ...p, meta_description: e.target.value }))}
                  placeholder="Brief description for search result snippets (120–160 chars)" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)] resize-none" />
                <p className="text-xs text-[var(--gray-400)] mt-1">{(editing.meta_description || '').length}/160 chars</p>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--gray-600)] mb-1.5">OG / Social Share Image URL</label>
                <input type="url" value={editing.og_image || ''} onChange={e => setEditing(p => ({ ...p, og_image: e.target.value }))}
                  placeholder="https://... (1200×630 recommended)" className="w-full px-3 py-2 border border-[var(--gray-200)] rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary-600)]" />
              </div>
              <label className="flex items-center gap-2.5 cursor-pointer">
                <input type="checkbox" checked={!!editing.is_published} onChange={e => setEditing(p => ({ ...p, is_published: e.target.checked }))}
                  className="w-4 h-4 rounded accent-[var(--primary-600)]" />
                <span className="text-sm text-[var(--dark-950)]">Publish immediately</span>
              </label>
            </div>
            <div className="p-5 border-t border-[var(--gray-100)] flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setEditing(null)}>Cancel</Button>
              <Button className="flex-1" loading={saving} onClick={handleSave}>{isNew ? 'Create Post' : 'Save Changes'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
