'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  MagnifyingGlass,
  ArrowRight,
  Copy,
  Check,
  DownloadSimple,
  X,
  LinkSimple,
} from '@phosphor-icons/react';


const T_HOME = {
  en: {
    brand: 'Url2Design',
    heroTitle: 'URL in. Agent-ready design system out.',
    heroSub: 'Paste any live site. Extract DESIGN.md, Tailwind, CSS variables, and DTCG tokens in seconds.',
    extractPlaceholder: 'https://stripe.com',
    extractBtn: 'Extract',
    freeNote: 'Free on the web',
    apiNote: 'Paid API',
    browseExamples: 'Library',
    step1: 'Paste a public URL',
    step1Body: 'We render the live page and read the real design system.',
    step2: 'Export four formats',
    step2Body: 'DESIGN.md, Tailwind v4, CSS variables, and DTCG tokens.',
    step3: 'Automate with the API',
    step3Body: 'Keys, credits, and /api/v1/extract for agents or CI.',
    worksWith: 'Works with',
    libraryTitle: 'Live extracts from the open web.',
    librarySub: 'Each entry was captured from a public URL and stored as reusable tokens.',
    styles: 'styles',
    faqTitle: 'FAQ',
    faq: [
      {
        q: 'What do I get from a URL?',
        a: 'A DESIGN.md plus Tailwind v4, CSS variables, and DTCG tokens from the live rendered page.',
      },
      {
        q: 'Do I need an account?',
        a: 'No for free web extracts (daily limit). Sign in only for API keys and metered usage.',
      },
      {
        q: 'How is this different from a design catalog?',
        a: 'Url2Design is a live extraction engine. Paste any URL. It is not a static brand collection.',
      },
      {
        q: 'Who is the API for?',
        a: 'Coding agents, CI jobs, and developers who need programmatic design-token extraction.',
      },
      {
        q: 'Which sites work?',
        a: 'Any publicly reachable HTTP/HTTPS page: marketing sites, SPAs, and server-rendered apps.',
      },
    ],
    specimenLabel: 'DESIGN.md',
    specimenSource: 'stripe.com',
    specimenYaml: 'colors:\n  ink: "#0A0B0D"\n  signal: "#FF3B00"\n  stone: "#EEF0F3"\ntypography:\n  display: Syne\n  body: IBM Plex Sans',
    apiBandTitle: 'Wire extraction into your agent',
    apiBandBody: 'Create keys, track credits, and call /api/v1/extract from Cursor, Claude Code, Copilot, or CI.',
    apiBandCta: 'Open dashboard',
  },
  zh: {
    brand: 'Url2Design',
    heroTitle: '输入 URL，输出 agent 可读的设计系统。',
    heroSub: '粘贴任意线上网址，数秒提取 DESIGN.md、Tailwind、CSS 变量与 DTCG tokens。',
    extractPlaceholder: 'https://stripe.com',
    extractBtn: '提取',
    freeNote: '网页免费',
    apiNote: '付费 API',
    browseExamples: '案例库',
    step1: '粘贴公开 URL',
    step1Body: '我们渲染真实页面并读取设计系统。',
    step2: '导出四种格式',
    step2Body: 'DESIGN.md、Tailwind v4、CSS 变量、DTCG tokens。',
    step3: '用 API 自动化',
    step3Body: 'Key、credits，以及给 agents / CI 的 /api/v1/extract。',
    worksWith: '可配合',
    libraryTitle: '来自真实网页的即时提取。',
    librarySub: '每条记录都捕获自公开 URL，并保存为可复用 tokens。',
    styles: '个样式',
    faqTitle: '常见问题',
    faq: [
      {
        q: '输入 URL 会得到什么？',
        a: '一份 DESIGN.md，以及 Tailwind v4、CSS 变量、DTCG tokens，均来自真实渲染页面。',
      },
      {
        q: '需要注册吗？',
        a: '网页免费提取不需要（有日限额）。只有需要 API Key 与计量用量时才登录。',
      },
      {
        q: '和设计合集站有什么不同？',
        a: 'Url2Design 是即时提取引擎：粘贴任意 URL 即可，不是静态品牌目录。',
      },
      {
        q: 'API 给谁用？',
        a: 'Coding agents、CI，以及需要程序化提取设计令牌的开发者。',
      },
      {
        q: '支持哪些网站？',
        a: '任意可公开访问的 HTTP/HTTPS 页面：营销站、SPA、服务端渲染站点均可。',
      },
    ],
    specimenLabel: 'DESIGN.md',
    specimenSource: 'stripe.com',
    specimenYaml: 'colors:\n  ink: "#0A0B0D"\n  signal: "#FF3B00"\n  stone: "#EEF0F3"\ntypography:\n  display: Syne\n  body: IBM Plex Sans',
    apiBandTitle: '把提取接到你的 agent',
    apiBandBody: '创建 Key、查看额度，从 Cursor / Claude Code / Copilot / CI 调用 /api/v1/extract。',
    apiBandCta: '打开控制台',
  },
};

const PAGE_SIZE = 20;

const WORKS_WITH = ['Cursor', 'Claude Code', 'Copilot', 'Codex', 'Devin', 'CI'];

const SPECIMEN_SWATCHES = [
  { name: 'ink', hex: '#0A0B0D' },
  { name: 'signal', hex: '#FF3B00' },
  { name: 'stone', hex: '#EEF0F3' },
  { name: 'mist', hex: '#8B95A5' },
];

const SPECIMEN_FORMATS = ['DESIGN.md', 'Tailwind v4', 'CSS vars', 'DTCG'];

function LogoMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
      <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
      <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
      <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
    </svg>
  );
}

function VideoCard({ card, onCardClick }) {
  const videoRef  = useRef(null);
  const wrapRef   = useRef(null);
  const [videoActive, setVideoActive] = useState(false);

  function handleMouseEnter() {
    const v = videoRef.current;
    if (!v) return;
    setVideoActive(true);
    v.play().catch(() => setVideoActive(false));
  }

  function handleMouseLeave() {
    const v = videoRef.current;
    if (!v) return;
    v.pause();
    v.currentTime = 0;
    setVideoActive(false);
  }

  return (
    <button
      className="card"
      onClick={() => onCardClick(card.id)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={`card-mode-bar ${card.color_scheme?.toLowerCase() || 'light'}`} />
      <div className="card-image-wrap" ref={wrapRef}>
        {!videoActive && (
          <img
            className="card-image"
            src={card.preview}
            alt={card.name}
            loading="lazy"
          />
        )}
        {card.video_url && (
          <video
            ref={videoRef}
            className="card-video"
            src={card.video_url}
            poster={card.preview}
            muted
            loop
            playsInline
            preload="none"
            style={{ opacity: videoActive ? 1 : 0 }}
          />
        )}
      </div>
      <div className="card-body">
        <div className="card-info">
          <div className="card-name-row">
            <span className="card-name">{card.name}</span>
            <span className="card-tag">{card.category || card.north_star}</span>
          </div>
          {card.color_scheme && (
            <div className="card-desc">{card.color_scheme}</div>
          )}
        </div>
        <ArrowRight size={14} weight="bold" className="card-arrow" />
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [url, setUrl]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [upgradeUrl, setUpgradeUrl] = useState(null);
  const [output, setOutput]     = useState(null);
  const [locale, setLocale]     = useState('en');

  useEffect(() => {
    setLocale(/^zh/.test(navigator.language) ? 'zh' : 'en');
  }, []);
  const [activeFilter, setActiveFilter] = useState('all');
  const [copied, setCopied]     = useState(false);
  const [toast, setToast]       = useState(null);
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');

  const [cards, setCards]       = useState([]);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal]       = useState(0);
  const [categories, setCategories] = useState([]);

  const sentinelRef = useRef(null);

  const loadPage = useCallback(async (pg) => {
    if (pg === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/cards?category=${activeFilter}&page=${pg}&limit=${PAGE_SIZE}${searchParam}`);
      const data = await res.json();

      if (pg === 1) {
        setCards(data.cards || []);
        if (data.categories) {
          setCategories(data.categories);
        }
      } else {
        setCards(prev => [...prev, ...(data.cards || [])]);
      }
      setHasMore(data.hasMore || false);
      setTotal(data.total || 0);
    } catch (_) {}

    if (pg === 1) setLoading(false);
    else setLoadingMore(false);
  }, [activeFilter, search]);

  useEffect(() => {
    setCards([]);
    setPage(1);
    setHasMore(true);
    setTotal(0);
    const t = setTimeout(() => loadPage(1), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== search) {
        setSearch(searchInput);
        setActiveFilter('all');
        setCards([]);
        setPage(1);
        setHasMore(true);
        setTotal(0);
        loadPage(1);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (page === 1) return;
    loadPage(page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
          setPage(prev => prev + 1);
        }
      },
      { rootMargin: '300px' }
    );
    const sentinel = sentinelRef.current;
    if (sentinel) observer.observe(sentinel);
    return () => { if (sentinel) observer.unobserve(sentinel); };
  }, [hasMore, loadingMore, loading]);

  async function handleExtract(targetUrl) {
    if (!targetUrl) return;
    setLoading(true);
    setError(null);
    setUpgradeUrl(null);
    setOutput(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        const errMsg = typeof data.error === 'object' ? data.error.message : data.error;
        if (data.upgradeUrl) setUpgradeUrl(data.upgradeUrl);
        throw new Error(errMsg || 'Extraction failed');
      }

      if (data.cardId) {
        if (data.isDuplicate) {
          setToast(data.message || '已跳转到已有记录');
          setTimeout(() => setToast(null), 3000);
        }
        router.push(`/style/${data.cardId}`);
        return;
      }

      setOutput(data.designMd);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleCardClick(id) {
    router.push(`/style/${id}`);
  }

  function handleSubmit(e) {
    e.preventDefault();
    handleExtract(url);
  }

  function handleCopy() {
    if (!output) return;
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleDownload() {
    if (!output) return;
    const blob = new Blob([output], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'DESIGN.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const t = T_HOME[locale] || T_HOME.en;
  const steps = [
    { title: t.step1, body: t.step1Body },
    { title: t.step2, body: t.step2Body },
    { title: t.step3, body: t.step3Body },
  ];

  return (
    <div className="page">
      <div className="page-ambient" aria-hidden="true">
        <div className="page-ambient-glow page-ambient-glow--1" />
        <div className="page-ambient-glow page-ambient-glow--2" />
        <div className="page-ambient-glow page-ambient-glow--3" />
      </div>

      <header className="header">
        <a className="header-logo" href="/">
          <div className="header-logo-icon">
            <LogoMark />
          </div>
          <div className="header-logo-text">
            Url<span>2Design</span>
          </div>
        </a>
        <nav className="header-nav" aria-label="Primary">
          <div className="header-lang">
            <button type="button" className={`lang-btn${locale === 'en' ? ' active' : ''}`} onClick={() => setLocale('en')}>EN</button>
            <button type="button" className={`lang-btn${locale === 'zh' ? ' active' : ''}`} onClick={() => setLocale('zh')}>中文</button>
          </div>
          <a className="header-link" href="#library">{t.browseExamples}</a>
          <a className="header-link header-link-primary" href="/dashboard">{t.apiNote}</a>
        </nav>
      </header>

      <section className="hero-stage">
        <div className="hero-grid" aria-hidden="true" />
        <div className="hero-inner">
          <div className="hero-copy">
            <p className="hero-eyebrow">{t.brand}</p>
            <h1 className="hero-title">
              {locale === 'zh' ? (
                <>输入 URL，输出 <span className="hero-title-highlight">设计系统</span>。</>
              ) : (
                <>URL in. <span className="hero-title-highlight">Design system</span> out.</>
              )}
            </h1>
            <p className="hero-subtitle">{t.heroSub}</p>

            <div className="hero-form-wrap">
              <form className="hero-form" onSubmit={handleSubmit}>
                <div className="hero-form-input-wrap">
                  <LinkSimple className="hero-form-icon" size={16} weight="bold" />
                  <input
                    className="hero-form-input"
                    type="text"
                    placeholder={t.extractPlaceholder}
                    value={url}
                    onChange={e => setUrl(e.target.value)}
                    aria-label="URL"
                  />
                </div>
                <button
                  className="hero-form-btn"
                  type="submit"
                  disabled={loading || !url}
                >
                  {loading ? (locale === 'zh' ? '提取中…' : 'Extracting…') : t.extractBtn}
                </button>
              </form>
              <p className="hero-meta">
                <span>{t.freeNote}</span>
                <span className="hero-meta-dot" aria-hidden="true" />
                <a href="/dashboard">{t.apiNote}</a>
              </p>
            </div>
          </div>

          <aside className="hero-specimen" aria-label={t.specimenLabel}>
            <div className="specimen-chrome">
              <span className="specimen-file">{t.specimenLabel}</span>
              <span className="specimen-source">{t.specimenSource}</span>
            </div>
            <pre className="specimen-yaml">{t.specimenYaml}</pre>
            <div className="specimen-swatches">
              {SPECIMEN_SWATCHES.map((swatch) => (
                <div key={swatch.name} className="specimen-swatch">
                  <span className="specimen-chip" style={{ background: swatch.hex }} />
                  <div>
                    <strong>{swatch.name}</strong>
                    <em>{swatch.hex}</em>
                  </div>
                </div>
              ))}
            </div>
            <div className="specimen-type">
              <p className="specimen-display">Syne</p>
              <p className="specimen-body">IBM Plex Sans · 16 / 24</p>
            </div>
            <div className="specimen-formats">
              {SPECIMEN_FORMATS.map((format) => (
                <span key={format}>{format}</span>
              ))}
            </div>
          </aside>
        </div>
      </section>

      <main className="main">
        <div className="works-with">
          <span>{t.worksWith}</span>
          <ul className="works-with-list">
            {WORKS_WITH.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </ul>
        </div>

        <section className="process-rail" aria-label="How it works">
          {steps.map((step, index) => (
            <article key={step.title} className="process-step">
              <span className="process-index" aria-hidden="true">0{index + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </article>
          ))}
        </section>

        <div id="library" className="library-section">
          <div className="library-heading">
            <h2 className="library-title">{t.libraryTitle}</h2>
            <p className="library-subtitle">{t.librarySub}</p>
          </div>

        <div className="library-toolbar">
          <div className="library-search">
            <MagnifyingGlass size={16} weight="bold" />
            <input
              type="text"
              placeholder={locale === 'zh' ? '搜索已提取的网站…' : 'Search extracted sites…'}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
            {searchInput && (
              <button
                type="button"
                className="library-search-clear"
                onClick={() => { setSearchInput(''); setSearch(''); }}
                aria-label="Clear"
              >
                <X size={14} weight="bold" />
              </button>
            )}
          </div>
        </div>

        <div className="filter-row">
          <button
            className={`filter-pill${activeFilter === 'all' && !search ? ' active' : ''}`}
            onClick={() => { setActiveFilter('all'); setSearchInput(''); setSearch(''); }}
          >
            {locale === 'zh' ? '全部' : 'All'} ({total})
          </button>
          {categories.map(cat => (
            <button
              key={cat.slug}
              className={`filter-pill${activeFilter === cat.slug && !search ? ' active' : ''}`}
              onClick={() => { setActiveFilter(cat.slug); setSearchInput(''); setSearch(''); }}
            >
              {locale === 'zh' ? cat.name_zh : cat.name_en} ({cat.card_count})
            </button>
          ))}
        </div>

        {error && (
          <div className="error-block" style={{ marginBottom: '24px' }}>
            <strong>{locale === 'zh' ? '错误：' : ''}</strong>{error}
            {upgradeUrl && (
              <> {' '}
                <a href={upgradeUrl} style={{ color: 'var(--accent)', fontWeight: 600 }}>
                  {locale === 'zh' ? '开通 API →' : 'Get API keys →'}
                </a>
              </>
            )}
          </div>
        )}

        {toast && (
          <div className="toast" role="status">
            {toast}
          </div>
        )}

        {loading && (
          <div className="loading-wrap">
            <div className="loading-spinner" />
            <div className="loading-text">{locale === 'zh' ? '正在提取 ' : 'Extracting '}{url}</div>
          </div>
        )}

        {!loading && output && (
          <div>
            <div className="results-header">
              <div>
                <div className="results-title">DESIGN.md</div>
                <div className="results-meta">{url}</div>
              </div>
              <div className="results-actions">
                <button className={`btn-action${copied ? ' copied' : ''}`} onClick={handleCopy}>
                  {copied ? <Check size={12} weight="bold" /> : <Copy size={12} weight="bold" />}
                  {copied ? (locale === 'zh' ? '已复制！' : 'Copied!') : (locale === 'zh' ? '复制' : 'Copy')}
                </button>
                <button className="btn-action" onClick={handleDownload}>
                  <DownloadSimple size={12} weight="bold" />
                  {locale === 'zh' ? '下载' : 'Download'}
                </button>
              </div>
            </div>
            <div className="output-card">
              <div className="output-header">
                <div className="output-filename">DESIGN.md</div>
              </div>
              <div className="output-body">{output}</div>
            </div>
          </div>
        )}

        {!loading && !output && (
          <div className="cards-section">
            <div className="cards-header">
              <span className="cards-count">{total} {locale === 'zh' ? '个样式' : 'styles'}</span>
              <div className="cards-header-line" />
            </div>
            <div className="cards-grid">
              {cards.length === 0 && loading ? (
                <>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} className="card-skeleton">
                      <div className="skeleton-image" />
                      <div className="skeleton-body">
                        <div className="skeleton-title" />
                        <div className="skeleton-tag" />
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                cards.map(card => (
                  <VideoCard
                    key={card.id}
                    card={card}
                    onCardClick={handleCardClick}
                  />
                ))
              )}
            </div>

            <div ref={sentinelRef} style={{ height: '1px' }} />

            {loadingMore && (
              <div className="loading-wrap" style={{ marginTop: '24px' }}>
                <div className="loading-spinner" />
              </div>
            )}

            {!hasMore && cards.length > 0 && (
              <div className="cards-footer">
                <span className="cards-footer-text">{locale === 'zh' ? `全部 ${total} 个样式已加载` : `All ${total} styles loaded`}</span>
              </div>
            )}
          </div>
        )}

        </div>{/* /library-section */}

        <section className="api-band">
          <div className="api-band-copy">
            <h2>{t.apiBandTitle}</h2>
            <p>{t.apiBandBody}</p>
          </div>
          <a className="api-band-cta" href="/dashboard">{t.apiBandCta}</a>
        </section>

        <section className="faq-section" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="faq-title">{t.faqTitle}</h2>
          <div className="faq-grid">
            {t.faq.map((item) => (
              <article key={item.q} className="faq-item">
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="footer">
        <strong>Url2Design</strong>
        <a href="/dashboard">{locale === 'zh' ? '开发者 API' : 'Developer API'}</a>
      </footer>
    </div>
  );
}
