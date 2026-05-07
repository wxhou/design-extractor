'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';


const T_HOME = {
  en: {
    heroTitle: 'Turn any URL into a',
    heroSub: 'Extract colors, typography, spacing, and components into a structured DESIGN.md your AI agent can use.',
    extractPlaceholder: 'https://stripe.com',
    extractBtn: 'Extract Tokens',
    styles: 'styles',
  },
  zh: {
    heroTitle: '将任意网址转换为',
    heroSub: '提取颜色、字体、间距和组件，生成结构化的 DESIGN.md，供 AI 代理直接使用。',
    extractPlaceholder: '输入网址',
    extractBtn: '提取设计令牌',
    styles: '个样式',
  },
};

const PAGE_SIZE = 20;

function ArrowIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" className="card-arrow">
      <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="search-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M10.5 10.5L13.5 13.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function LogoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="white" opacity="0.9"/>
      <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
      <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.6"/>
      <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity="0.3"/>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <rect x="4" y="4" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.2"/>
      <path d="M3 8H2a1 1 0 01-1-1V2a1 1 0 011-1h5a1 1 0 011 1v1" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M6 2v6M3.5 5.5L6 8l2.5-2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 10h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
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
    // 有视频才激活，hover 时播放
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
      {/* 模式色条指示器 */}
      <div className={`card-mode-bar ${card.color_scheme?.toLowerCase() || 'light'}`} />
      <div className="card-image-wrap" ref={wrapRef}>
        {/* 封面图：视频激活时隐藏 */}
        {!videoActive && (
          <img
            className="card-image"
            src={card.preview}
            alt={card.name}
            loading="lazy"
          />
        )}
        {/* 视频层：始终渲染，videoActive 控制显隐 */}
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
        <ArrowIcon />
      </div>
    </button>
  );
}

export default function Home() {
  const router = useRouter();
  const [url, setUrl]           = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);
  const [output, setOutput]     = useState(null);
  const [locale, setLocale]     = useState('en');

  useEffect(() => {
    setLocale(/^zh/.test(navigator.language) ? 'zh' : 'en');
  }, []);
  const [activeFilter, setActiveFilter] = useState('all');
  const [copied, setCopied]     = useState(false);
  // Toast 提示
  const [toast, setToast]       = useState(null);
  // 搜索
  const [search, setSearch]     = useState('');
  const [searchInput, setSearchInput] = useState('');

  // 无限滚动相关
  const [cards, setCards]       = useState([]);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [total, setTotal]       = useState(0);
  // 分类计数
  const [categoryCounts, setCategoryCounts] = useState({});
  // 分类列表（从 API 动态获取）
  const [categories, setCategories] = useState([]);

  const sentinelRef = useRef(null);

  // 加载某一页
  const loadPage = useCallback(async (pg) => {
    if (pg === 1) setLoading(true);
    else setLoadingMore(true);

    try {
      const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`/api/cards?category=${activeFilter}&page=${pg}&limit=${PAGE_SIZE}${searchParam}`);
      const data = await res.json();

      if (pg === 1) {
        setCards(data.cards || []);
        // 使用 API 返回的真实分类计数和分类列表
        if (data.categoryCounts) {
          setCategoryCounts(data.categoryCounts);
        }
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

  // 首次加载 + filter 切换后重置并加载
  useEffect(() => {
    setCards([]);
    setPage(1);
    setHasMore(true);
    setTotal(0);
    // 等 setPage 同步完成，下一轮再加载
    const t = setTimeout(() => loadPage(1), 0);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFilter, search]);

  // 搜索处理（debounce）
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

  // page 递增时加载下一页（IntersectionObserver 触发 setPage）
  useEffect(() => {
    if (page === 1) return; // page=1 由上面的 filter effect 处理
    loadPage(page);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  // 无限滚动 sentinel
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
    setOutput(null);
    try {
      const res = await fetch('/api/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });
      const data = await res.json();

      // 处理 API 级别的错误（URL 验证失败等）
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Extraction failed');
      }

      // 如果返回 cardId，跳转到详情页
      if (data.cardId) {
        // 如果是重复，显示提示
        if (data.isDuplicate) {
          setToast(data.message || '已跳转到已有记录');
          setTimeout(() => setToast(null), 3000);
        }
        router.push(`/style/${data.cardId}`);
        return;
      }

      // 否则显示输出（备用）
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

  return (
    <div className="page">
      <header className="header">
        <div className="header-logo">
          <div className="header-logo-icon">
            <LogoIcon />
          </div>
          <div className="header-logo-text">
            Design<span>Extractor</span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div className="header-lang">
            <button className={`lang-btn${locale === 'en' ? ' active' : ''}`} onClick={() => setLocale('en')}>EN</button>
            <button className={`lang-btn${locale === 'zh' ? ' active' : ''}`} onClick={() => setLocale('zh')}>中文</button>
          </div>
          <div className="header-status">
            <div className="header-dot" />
            <span>{locale === 'zh' ? 'AI 驱动' : 'AI-powered'}</span>
          </div>
        </div>
      </header>

      <main className="main">
        <div className="hero">

          <h1 className="hero-title">
            {locale === 'zh' ? (
              <>提取任意网址的<br /><span className="accent">DESIGN.md</span></>
            ) : (
              <>Turn any URL into a<br /><span className="accent">DESIGN.md</span></>
            )}
          </h1>
          <p className="hero-subtitle">
            {locale === 'zh'
              ? '提取颜色、字体、间距和组件，生成结构化的 DESIGN.md，供 AI 代理直接使用。'
              : 'Extract colors, typography, spacing, and components into a structured DESIGN.md your AI agent can use.'}
          </p>
        </div>

        <div className="search-section">
          <form className="search-container" onSubmit={handleSubmit}>
            <div className="search-input-wrap">
              <SearchIcon />
              <input
                className="search-input"
                type="text"
                placeholder={locale === 'zh' ? '输入网址' : 'https://stripe.com'}
                value={url}
                onChange={e => setUrl(e.target.value)}
              />
            </div>
            <button
              className="search-btn"
              type="submit"
              disabled={loading || !url}
            >
              {loading ? (locale === 'zh' ? '提取中...' : 'Extracting...') : (locale === 'zh' ? '提取设计令牌' : 'Extract Tokens')}
            </button>
          </form>
        </div>

        {/* 搜索框 */}
        <div style={{ padding: '0 24px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <SearchIcon />
            <input
              type="text"
              placeholder={locale === 'zh' ? '搜索网站...' : 'Search sites...'}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none'
              }}
            />
            {searchInput && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); }}
                style={{
                  padding: '4px 8px',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--text-muted)'
                }}
              >
                ✕
              </button>
            )}
          </div>
          {search && (
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {locale === 'zh' ? '搜索结果' : 'Search results for'}: "{search}"
              <button
                onClick={() => { setSearchInput(''); setSearch(''); }}
                style={{
                  marginLeft: '8px',
                  color: 'var(--accent)',
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  fontSize: '12px'
                }}
              >
                {locale === 'zh' ? '清除' : 'Clear'}
              </button>
            </div>
          )}
        </div>

        <div className="filter-row">
          {/* 全部按钮 */}
          <button
            className={`filter-pill${activeFilter === 'all' && !search ? ' active' : ''}`}
            onClick={() => { setActiveFilter('all'); setSearchInput(''); setSearch(''); }}
          >
            {locale === 'zh' ? '全部' : 'All'} ({total})
          </button>
          {/* 从数据库动态加载的分类 */}
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
          <>
          {locale === 'zh' && (
            <div className="error-block" style={{ marginBottom: '24px' }}>
              <strong>错误：</strong>{error}
            </div>
          )}
          {!locale.startsWith('zh') && (
            <div className="error-block" style={{ marginBottom: '24px' }}>
              {error}
            </div>
          )}
          </>
        )}

        {toast && (
          <div className="toast" style={{
            position: 'fixed',
            top: '100px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            color: '#fff',
            padding: '12px 24px',
            borderRadius: '8px',
            zIndex: 1000,
            fontSize: '14px'
          }}>
            {toast}
          </div>
        )}

        {loading && (
          <div className="loading-wrap">
            <div className="loading-spinner" />
            <div className="loading-text">Analyzing {url}...</div>
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
                  {copied ? <CheckIcon /> : <CopyIcon />}
                  {copied ? (locale === 'zh' ? '已复制！' : 'Copied!') : (locale === 'zh' ? '复制' : 'Copy')}
                </button>
                <button className="btn-action" onClick={handleDownload}>
                  <DownloadIcon />
                  {locale === 'zh' ? '下载' : 'Download'}
                </button>
              </div>
            </div>
            <div className="output-card">
              <div className="output-header">
                <div className="output-dots">
                  <div className="output-dot" />
                  <div className="output-dot" />
                  <div className="output-dot" />
                </div>
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
              {cards.map(card => (
                <VideoCard
                  key={card.id}
                  card={card}
                  onCardClick={handleCardClick}
                />
              ))}
            </div>

            {/* 加载更多 sentinel */}
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
      </main>

      <footer className="footer">
        <span>Design Extractor</span>
      </footer>
    </div>
  );
}
