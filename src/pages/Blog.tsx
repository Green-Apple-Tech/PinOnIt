import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowRight, Moon, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { Footer } from '../components/Footer';
import { JsonLd } from '../components/JsonLd';
import { useTheme } from '../hooks/useTheme';
import { usePageMeta } from '../lib/pageMeta';
import { signupHref } from '../lib/campaignAttribution';
import {
  BLOG_INDEX,
  BLOG_POSTS,
  blogPostBySlug,
  type BlogBlock,
  type BlogPost,
} from '../lib/blogPosts';
import { blogIndexJsonLd, blogPostingJsonLd, organizationJsonLd } from '../lib/jsonLd';
import { INTENT_OG_IMAGE } from '../lib/seoIntentPages';
import { MarketingStickyHeader } from '../components/landing/MarketingAnnouncementBar';

function BlogChrome({ children }: { children: ReactNode }) {
  const { theme, toggleTheme } = useTheme();
  const signup = signupHref();
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col">
      <MarketingStickyHeader>
      <nav className="bg-white/95 dark:bg-slate-950/95 backdrop-blur border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="shrink-0">
            <img src="/pinonit_logo.png" alt="PinOnIt" className="h-11 w-auto" />
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <Link to="/login" className="hidden sm:inline px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Log in
            </Link>
            <Link
              to={signup}
              className="inline-flex items-center gap-1 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-full"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </nav>
      </MarketingStickyHeader>
      {children}
      <Footer />
    </div>
  );
}

function BlockView({ block }: { block: BlogBlock }) {
  if (block.type === 'h2') {
    return <h2 className="mt-10 text-lg font-bold">{block.text}</h2>;
  }
  if ('link' in block) {
    return (
      <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">
        {block.before}
        <Link to={block.link.href} className="text-brand-600 dark:text-brand-400 font-medium underline underline-offset-2">
          {block.link.text}
        </Link>
        {block.after}
      </p>
    );
  }
  return <p className="mt-4 text-slate-600 dark:text-slate-300 leading-relaxed">{block.text}</p>;
}

export function BlogIndexPage() {
  usePageMeta({
    title: BLOG_INDEX.title,
    description: BLOG_INDEX.description,
    url: BLOG_INDEX.canonical,
    image: INTENT_OG_IMAGE,
  });

  return (
    <BlogChrome>
      <JsonLd data={[organizationJsonLd(), blogIndexJsonLd()]} />
      <main className="flex-1 px-6 py-12 md:py-16">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-3">Blog</p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">{BLOG_INDEX.h1}</h1>
          <p className="mt-5 text-lg text-slate-700 dark:text-slate-200 leading-relaxed">{BLOG_INDEX.description}</p>
          <ul className="mt-10 space-y-6">
            {BLOG_POSTS.map((post) => (
              <li key={post.slug}>
                <Link to={post.path} className="group block">
                  <h2 className="text-lg font-bold group-hover:text-brand-600 dark:group-hover:text-brand-400">
                    {post.title.replace(/ \| PinOnIt$/, '')}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{post.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
    </BlogChrome>
  );
}

function PostArticle({ post }: { post: BlogPost }) {
  usePageMeta({
    title: post.title,
    description: post.description,
    url: post.canonical,
    image: INTENT_OG_IMAGE,
  });
  const signup = signupHref();

  return (
    <BlogChrome>
      <JsonLd data={[organizationJsonLd(), blogPostingJsonLd(post)]} />
      <main className="flex-1 px-6 py-12 md:py-16">
        <article className="max-w-3xl mx-auto">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-600 dark:text-brand-400 mb-3">
            <Link to="/blog" className="hover:underline">
              Field notes
            </Link>
          </p>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-tight">
            {post.title.replace(/ \| PinOnIt$/, '')}
          </h1>
          <p className="mt-3 text-sm text-slate-400">{post.datePublished}</p>
          {post.blocks.map((block, i) => (
            <BlockView key={i} block={block} />
          ))}
          <div className="mt-12 rounded-2xl bg-brand-500 px-6 py-8 text-center text-white">
            <Link
              to={signup}
              className="inline-flex items-center gap-2 min-h-11 px-6 rounded-full bg-white text-brand-600 text-sm font-semibold"
            >
              Start 14-day trial <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </article>
      </main>
    </BlogChrome>
  );
}

export function BlogPostPage() {
  const { slug } = useParams();
  const post = slug ? blogPostBySlug(slug) : null;
  if (!post) return <Navigate to="/blog" replace />;
  return <PostArticle post={post} />;
}
