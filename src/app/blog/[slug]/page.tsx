import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '@/app/page';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://attenda.app';

async function getPost(slug: string) {
  try {
    const res = await fetch(`${API_URL}/public/blog/${slug}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data as any;
  } catch {
    return null;
  }
}

// ─── Dynamic metadata ──────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) return { title: 'Post Not Found — Attenda' };

  const title       = post.meta_title       || `${post.title} | Attenda`;
  const description = post.meta_description || post.excerpt || '';
  const image       = post.og_image         || post.cover_image || `${SITE_URL}/og-default.png`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type:        'article',
      url:         `${SITE_URL}/blog/${slug}`,
      images:      [{ url: image, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.published_at ?? undefined,
      authors:     [post.author_name],
    },
    twitter: {
      card:        'summary_large_image',
      title,
      description,
      images:      [image],
    },
    alternates: { canonical: `${SITE_URL}/blog/${slug}` },
  };
}

function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Very lightweight markdown → HTML converter (headings, bold, lists, paragraphs)
function renderMarkdown(md: string): string {
  return md
    .replace(/^#{3} (.+)$/gm, '<h3 class="text-xl font-black text-white mt-12 mb-6 uppercase tracking-tight">$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2 class="text-3xl font-black text-white mt-16 mb-8 tracking-tighter leading-tight">$1</h2>')
    .replace(/^#{1} (.+)$/gm, '<h1 class="text-4xl font-black text-white mt-20 mb-10 tracking-tighter leading-tight">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-white">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em class="italic text-[var(--on-glass-sub)]">$1</em>')
    .replace(/^- (.+)$/gm, '<li class="flex items-start gap-4 mb-3"><span class="mt-2.5 w-1.5 h-1.5 rounded-full bg-[var(--primary-600)] flex-shrink-0"></span><span class="text-[15px] font-medium text-[var(--on-glass-muted)]">$1</span></li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start gap-4 mb-3"><span class="font-black text-[var(--primary-600)] flex-shrink-0 mt-0.5 tracking-tighter">$1.</span><span class="text-[15px] font-medium text-[var(--on-glass-muted)]">$2</span></li>')
    .replace(/(<li[\s\S]+?<\/li>)+/g, m => `<ul class="my-8 space-y-2">${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="text-[16px] md:text-[17px] font-medium text-[var(--on-glass-muted)] leading-[1.8] mb-8">')
    .replace(/^(.)/m, '<p class="text-[16px] md:text-[17px] font-medium text-[var(--on-glass-muted)] leading-[1.8] mb-8">$&')
    + '</p>';
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPost(slug);
  if (!post) notFound();

  // JSON-LD structured data for Google
  const jsonLd = {
    '@context':       'https://schema.org',
    '@type':          'Article',
    headline:         post.title,
    description:      post.meta_description || post.excerpt || '',
    image:            post.og_image || post.cover_image || undefined,
    datePublished:    post.published_at,
    dateModified:     post.updated_at,
    author: {
      '@type': 'Person',
      name:    post.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name:    'Attenda',
      logo: {
        '@type': 'ImageObject',
        url:     `${SITE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': '@id',
      '@id':   `${SITE_URL}/blog/${slug}`,
    },
  };

  return (
    <div className="bg-[var(--dark-950)] min-h-screen selection:bg-[var(--primary-600)] selection:text-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingNav />
      <main>
        {/* Header */}
        <section className="pt-44 pb-16 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[var(--primary-600)]/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="max-w-4xl mx-auto px-6 relative z-10">
            <Link href="/blog" className="text-[10px] font-black text-[var(--on-glass-dim)] hover:text-white uppercase tracking-[0.3em] transition-all inline-flex items-center gap-3 mb-10 group">
              <span className="group-hover:-translate-x-1 transition-transform">←</span> All articles
            </Link>

            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                {post.tags.map((tag: string) => (
                  <span key={tag} className="text-[9px] font-black px-3 py-1 bg-[var(--glass-10)] border border-[var(--glass-border)] text-white/70 rounded-full uppercase tracking-widest">{tag}</span>
                ))}
              </div>
            )}

            <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.1] mb-8 tracking-tighter">{post.title}</h1>

            {post.excerpt && (
              <p className="text-xl text-[var(--on-glass-muted)] leading-relaxed mb-10 font-medium">{post.excerpt}</p>
            )}

            <div className="flex flex-wrap items-center gap-8 py-8 border-y border-[var(--glass-border)]">
              <div className="flex items-center gap-4">
                {post.author_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author_avatar} alt={post.author_name} className="w-10 h-10 rounded-2xl object-cover border border-[var(--glass-border)] shadow-xl" />
                ) : (
                  <div className="w-10 h-10 rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center">
                    <span className="text-xs font-black text-[var(--primary-600)]">{post.author_name.charAt(0)}</span>
                  </div>
                )}
                <div>
                   <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-0.5">Author</p>
                   <p className="text-[13px] font-bold text-white">{post.author_name}</p>
                </div>
              </div>
              {post.published_at && (
                <div>
                   <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-0.5">Transmitted</p>
                   <p className="text-[13px] font-bold text-white">{formatDate(post.published_at)}</p>
                </div>
              )}
              {post.read_time_mins && (
                <div>
                   <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-0.5">Duration</p>
                   <p className="text-[13px] font-bold text-white">{post.read_time_mins} MIN READ</p>
                </div>
              )}
              {post.views > 0 && (
                <div>
                   <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest mb-0.5">Reach</p>
                   <p className="text-[13px] font-bold text-white">{post.views.toLocaleString()} VIEWS</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Cover image */}
        {post.cover_image && (
          <div className="max-w-5xl mx-auto px-6 relative z-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image} alt={post.title} className="w-full aspect-[21/9] object-cover rounded-[3rem] border border-[var(--glass-border)] shadow-2xl" />
          </div>
        )}

        {/* Content */}
        <article className="max-w-3xl mx-auto px-6 py-24 relative z-10">
          <div
            className="prose-content selection:bg-[var(--secondary)] selection:text-[var(--dark-950)]"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />
        </article>

        {/* CTA */}
        <section className="py-24 px-6 relative overflow-hidden">
          <div className="max-w-4xl mx-auto p-12 md:p-20 rounded-[4rem] bg-gradient-to-br from-[var(--dark-800)] to-[var(--dark-950)] border border-[var(--glass-border)] text-center relative z-10 group shadow-2xl">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 tracking-tight">Try Attenda free for 14 days</h2>
            <p className="text-lg text-[var(--on-glass-muted)] mb-10 font-medium">No credit card required. Up and running in minutes.</p>
            <Link href="/get-started"
              className="inline-flex items-center gap-3 px-10 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/20 text-sm uppercase tracking-widest active:scale-95">
              Get Started Free <span className="text-white/50">→</span>
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
