import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { MarketingNav, MarketingFooter } from '@/app/page';
import type { BlogPost } from '@/types';

export const metadata: Metadata = {
  title: 'Blog — Attenda | Workforce Management Insights',
  description: 'Expert articles on attendance management, HR strategy, shift scheduling, and workforce productivity.',
  openGraph: {
    title: 'Blog — Attenda',
    description: 'Expert articles on attendance management, HR strategy, shift scheduling, and workforce productivity.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blog — Attenda',
    description: 'Expert articles on attendance management, HR strategy, shift scheduling.',
  },
};

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

async function getPosts(page = 1) {
  try {
    const res = await fetch(`${API_URL}/public/blog?page=${page}&limit=9`, {
      next: { revalidate: 300 }, // 5 min cache
    });
    if (!res.ok) return { posts: [], total: 0, pages: 1 };
    const json = await res.json();
    return json.data as { posts: BlogPost[]; total: number; pages: number };
  } catch {
    return { posts: [], total: 0, pages: 1 };
  }
}

function formatDate(d: string | null) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const sp   = await searchParams;
  const page = Math.max(1, Number(sp.page) || 1);
  const { posts, total, pages } = await getPosts(page);

  return (
    <div className="bg-[var(--dark-950)] min-h-screen selection:bg-[var(--primary-600)] selection:text-white">
      <MarketingNav />
      <main>
        {/* Hero */}
        <section className="pt-44 pb-20 relative overflow-hidden">
          <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-[var(--primary-600)]/5 blur-[120px] rounded-full pointer-events-none" />
          <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--glass-05)] text-[10px] font-black uppercase tracking-[0.2em] text-[var(--primary-600)] mb-8">
              Attenda Blog
            </div>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-8 tracking-tighter leading-tight">
              Workforce <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--primary-600)] to-[var(--secondary)]">Insights.</span>
            </h1>
            <p className="text-lg md:text-xl text-[var(--on-glass-muted)] max-w-2xl mx-auto font-medium leading-relaxed">
              Intelligence on workforce optimization, strategic HR mapping, and the future of autonomous attendance infrastructure.
            </p>
          </div>
        </section>

        {/* Posts grid */}
        <section className="py-24 relative z-10">
          <div className="max-w-7xl mx-auto px-6">
            {posts.length === 0 ? (
              <div className="text-center py-20 p-10 rounded-[3rem] bg-[var(--glass-05)] border border-[var(--glass-border)]">
                <p className="text-[var(--on-glass-dim)] font-black uppercase tracking-[0.2em]">No posts yet — check back soon.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
                  {posts.map((post) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}
                      className="group bg-[var(--glass-05)] rounded-[2.5rem] overflow-hidden border border-[var(--glass-border)] hover:bg-[var(--glass-10)] hover:border-[var(--glass-high)] transition-all duration-500 hover:-translate-y-1">
                      {post.cover_image ? (
                        <div className="relative w-full h-56 overflow-hidden">
                          <Image src={post.cover_image} alt={post.title} fill className="object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all duration-700" />
                        </div>
                      ) : (
                        <div className="w-full h-56 bg-gradient-to-br from-[var(--dark-800)] to-[var(--dark-950)] flex items-center justify-center">
                          <span className="text-4xl filter grayscale">📝</span>
                        </div>
                      )}
                      <div className="p-8">
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-6">
                            {post.tags.slice(0, 2).map((tag: string) => (
                              <span key={tag} className="text-[10px] font-black px-3 py-1 bg-[var(--primary-600)]/10 text-[var(--primary-600)] rounded-full uppercase tracking-widest">{tag}</span>
                            ))}
                          </div>
                        )}
                        <h2 className="text-xl font-black text-white mb-4 leading-tight group-hover:text-[var(--primary-600)] transition-colors line-clamp-2">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-sm font-medium text-[var(--on-glass-muted)] leading-relaxed line-clamp-3 mb-6">{post.excerpt}</p>
                        )}
                        <div className="flex items-center justify-between text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest pt-6 border-t border-[var(--glass-border)]">
                          <span className="text-[var(--on-glass-muted)]">{post.author_name}</span>
                          <div className="flex items-center gap-3">
                            {post.read_time_mins && <span>{post.read_time_mins} MIN READ</span>}
                            {post.published_at && <span>{formatDate(post.published_at)}</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                  <div className="flex items-center justify-center gap-4">
                    {page > 1 && (
                      <Link href={`/blog?page=${page - 1}`}
                        className="px-6 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)] text-[11px] font-black text-white uppercase tracking-widest hover:bg-[var(--glass-10)] transition-all">
                        ← PREVIOUS
                      </Link>
                    )}
                    <span className="text-[11px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest">Page {page} of {pages}</span>
                    {page < pages && (
                      <Link href={`/blog?page=${page + 1}`}
                        className="px-6 py-3 rounded-xl border border-[var(--glass-border)] bg-[var(--glass-05)] text-[11px] font-black text-white uppercase tracking-widest hover:bg-[var(--glass-10)] transition-all">
                        NEXT →
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-32 px-6">
          <div className="max-w-4xl mx-auto p-12 md:p-20 rounded-[4rem] bg-gradient-to-br from-[var(--dark-800)] to-[var(--dark-950)] border border-[var(--glass-border)] text-center shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-full bg-[var(--primary-600)]/5 blur-[100px] rounded-full pointer-events-none group-hover:scale-110 transition-transform duration-1000" />

            <h2 className="text-4xl font-black text-white mb-6 tracking-tight relative z-10">Begin Your Transformation</h2>
            <p className="text-lg text-[var(--on-glass-muted)] mb-10 font-medium relative z-10">Start your 14-day enterprise trial. Zero friction. Total visibility.</p>
            <Link href="/get-started"
              className="relative z-10 inline-flex items-center gap-3 px-10 py-5 bg-[var(--primary-600)] hover:brightness-110 text-white font-black rounded-2xl transition-all shadow-2xl shadow-[var(--primary-600)]/20 text-sm uppercase tracking-widest active:scale-95">
              Secure Access Now <span className="text-white/50">→</span>
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
