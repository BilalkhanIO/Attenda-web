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
    .replace(/^#{3} (.+)$/gm, '<h3 class="text-lg font-bold text-[var(--dark-950)] mt-6 mb-2">$1</h3>')
    .replace(/^#{2} (.+)$/gm, '<h2 class="text-xl font-black text-[var(--dark-950)] mt-8 mb-3">$1</h2>')
    .replace(/^#{1} (.+)$/gm, '<h1 class="text-2xl font-black text-[var(--dark-950)] mt-8 mb-4">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-[var(--dark-950)]">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li class="flex items-start gap-2 mb-1"><span class="mt-1.5 w-1.5 h-1.5 rounded-full bg-[var(--primary-600)] flex-shrink-0"></span><span>$1</span></li>')
    .replace(/^(\d+)\. (.+)$/gm, '<li class="flex items-start gap-2 mb-1"><span class="font-bold text-[var(--primary-600)] flex-shrink-0 mt-0.5">$1.</span><span>$2</span></li>')
    .replace(/(<li[\s\S]+?<\/li>)+/g, m => `<ul class="space-y-0.5 my-4">${m}</ul>`)
    .replace(/\n\n/g, '</p><p class="text-[var(--gray-700)] leading-relaxed mb-4">')
    .replace(/^(.)/m, '<p class="text-[var(--gray-700)] leading-relaxed mb-4">$&')
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
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <MarketingNav />
      <main>
        {/* Header */}
        <section className="bg-[var(--dark-950)] pt-24 pb-12">
          <div className="max-w-3xl mx-auto px-6">
            <Link href="/blog" className="text-white/50 hover:text-white text-sm transition-colors inline-flex items-center gap-1.5 mb-8">
              ← All articles
            </Link>

            {post.tags?.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((tag: string) => (
                  <span key={tag} className="text-xs font-medium px-2.5 py-1 bg-white/10 text-white/70 rounded-full">{tag}</span>
                ))}
              </div>
            )}

            <h1 className="text-3xl md:text-4xl font-black text-white leading-tight mb-4">{post.title}</h1>

            {post.excerpt && (
              <p className="text-lg text-white/60 leading-relaxed mb-6">{post.excerpt}</p>
            )}

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2.5">
                {post.author_avatar ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.author_avatar} alt={post.author_name} className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-[var(--primary-600)] flex items-center justify-center">
                    <span className="text-xs font-bold text-white">{post.author_name.charAt(0)}</span>
                  </div>
                )}
                <span className="text-sm text-white/70">{post.author_name}</span>
              </div>
              {post.published_at && (
                <span className="text-sm text-white/40">{formatDate(post.published_at)}</span>
              )}
              {post.read_time_mins && (
                <span className="text-sm text-white/40">{post.read_time_mins} min read</span>
              )}
              {post.views > 0 && (
                <span className="text-sm text-white/40">{post.views.toLocaleString()} views</span>
              )}
            </div>
          </div>
        </section>

        {/* Cover image */}
        {post.cover_image && (
          <div className="max-w-3xl mx-auto px-6 -mt-6 mb-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image} alt={post.title} className="w-full h-56 md:h-72 object-cover rounded-2xl shadow-lg" />
          </div>
        )}

        {/* Content */}
        <article className="max-w-3xl mx-auto px-6 py-12">
          <div
            className="prose-content text-base leading-relaxed"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
          />
        </article>

        {/* CTA */}
        <section className="border-t border-[var(--gray-100)] py-12 bg-[var(--gray-50)]">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-xl font-black text-[var(--dark-950)] mb-2">Try Attenda free for 14 days</h2>
            <p className="text-[var(--gray-500)] mb-5 text-sm">No credit card required. Up and running in minutes.</p>
            <Link href="/get-started"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-bold rounded-xl text-sm transition-colors">
              Get Started Free →
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
