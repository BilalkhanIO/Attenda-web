import type { Metadata } from 'next';
import Link from 'next/link';
import { MarketingNav, MarketingFooter } from '@/app/page';

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
    return json.data as { posts: any[]; total: number; pages: number };
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
    <>
      <MarketingNav />
      <main>
        {/* Hero */}
        <section className="bg-[var(--dark-950)] pt-24 pb-16">
          <div className="max-w-5xl mx-auto px-6 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/10 bg-white/5 text-sm text-white/70 mb-6">
              Attenda Blog
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">
              Workforce Management Insights
            </h1>
            <p className="text-lg text-white/60 max-w-2xl mx-auto">
              Practical guides on attendance tracking, HR strategy, shift scheduling, and building a more productive workforce.
            </p>
          </div>
        </section>

        {/* Posts grid */}
        <section className="py-16 bg-[var(--gray-50)]">
          <div className="max-w-6xl mx-auto px-6">
            {posts.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[var(--gray-500)]">No posts yet — check back soon.</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                  {posts.map((post: any) => (
                    <Link key={post.id} href={`/blog/${post.slug}`}
                      className="group bg-white rounded-2xl overflow-hidden border border-[var(--gray-200)] hover:shadow-lg transition-all hover:-translate-y-0.5">
                      {post.cover_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.cover_image} alt={post.title} className="w-full h-44 object-cover" />
                      ) : (
                        <div className="w-full h-44 bg-gradient-to-br from-[var(--primary-600)]/10 to-[var(--primary-600)]/5 flex items-center justify-center">
                          <span className="text-4xl">📝</span>
                        </div>
                      )}
                      <div className="p-5">
                        {post.tags?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-3">
                            {post.tags.slice(0, 2).map((tag: string) => (
                              <span key={tag} className="text-xs font-medium px-2 py-0.5 bg-[var(--primary-100)] text-[var(--primary-600)] rounded-full">{tag}</span>
                            ))}
                          </div>
                        )}
                        <h2 className="text-base font-bold text-[var(--dark-950)] mb-2 leading-snug group-hover:text-[var(--primary-600)] transition-colors line-clamp-2">
                          {post.title}
                        </h2>
                        {post.excerpt && (
                          <p className="text-sm text-[var(--gray-500)] leading-relaxed line-clamp-3 mb-4">{post.excerpt}</p>
                        )}
                        <div className="flex items-center justify-between text-xs text-[var(--gray-400)]">
                          <span>{post.author_name}</span>
                          <div className="flex items-center gap-2">
                            {post.read_time_mins && <span>{post.read_time_mins} min</span>}
                            {post.published_at && <span>{formatDate(post.published_at)}</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>

                {/* Pagination */}
                {pages > 1 && (
                  <div className="flex items-center justify-center gap-2">
                    {page > 1 && (
                      <Link href={`/blog?page=${page - 1}`}
                        className="px-4 py-2 rounded-lg border border-[var(--gray-200)] text-sm text-[var(--gray-700)] hover:bg-[var(--gray-100)] transition-colors">
                        ← Previous
                      </Link>
                    )}
                    <span className="text-sm text-[var(--gray-500)]">Page {page} of {pages}</span>
                    {page < pages && (
                      <Link href={`/blog?page=${page + 1}`}
                        className="px-4 py-2 rounded-lg border border-[var(--gray-200)] text-sm text-[var(--gray-700)] hover:bg-[var(--gray-100)] transition-colors">
                        Next →
                      </Link>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-white border-t border-[var(--gray-100)]">
          <div className="max-w-2xl mx-auto px-6 text-center">
            <h2 className="text-2xl font-black text-[var(--dark-950)] mb-3">Ready to try Attenda?</h2>
            <p className="text-[var(--gray-500)] mb-6">Start your 14-day free trial — no credit card required.</p>
            <Link href="/get-started"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[var(--primary-600)] hover:bg-[var(--primary-900)] text-white font-bold rounded-xl transition-colors">
              Get Started Free →
            </Link>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
