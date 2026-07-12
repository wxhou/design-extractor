'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { BackIcon, ExternalIcon, CopyIcon, CheckIcon, DownloadIcon, CodeIcon, CloseIcon } from './components/icons.jsx';
import { getDesignMd as designMd } from './utils/design-md.js';
import { toCssName as exportUtil, getFormatCode as formatCode, getStyleDictionary as styleDict, getExportCode as exportCode } from './utils/export-utils.js';

const CATEGORY_COLORS = {
  minimal:   { bg: '#f5f3f0', accent: '#1a100e' },
  saas:      { bg: '#f8f9fc', accent: '#4f46e5' },
  editorial: { bg: '#faf9f7', accent: '#c0392b' },
  retro:     { bg: '#fdf6e3', accent: '#d97706' },
  playful:   { bg: '#fef9ec', accent: '#f59e0b' },
  gradient:  { bg: '#f0f4ff', accent: '#6366f1' },
  dark:      { bg: '#0f0f0f', accent: '#ffffff' },
};

// i18n translations
const T = {
  en: {
    // Nav
    styles: 'Styles',
    apiCta: 'API for agents',
    apiCtaLink: 'Get API keys →',
    // Section titles
    colorPalette: 'Color Palette',
    typography: 'Typography',
    typeScale: 'Type Scale',
    gradients: 'Gradients',
    elevationPhilosophy: 'Elevation Philosophy',
    spacing: 'Spacing',
    surfaces: 'Surfaces',
    shapes: 'Shapes',
    imagery: 'Imagery',
    layout: 'Layout',
    dosDonts: "Dos & Don'ts",
    components: 'Components',
    customSections: 'Custom Sections',
    // Sub-labels
    fontFamiliesUsed: 'Font families used on this site',
    minorThirdBase: 'Minor Third · Base 20px',
    photographyStyle: 'Photography and illustration style',
    gridSystem: 'Grid system and structural decisions',
    borderRadiusTokens: 'Border radius and corner tokens',
    surfaceTones: 'Card, modal, and panel background tones',
    spatialRhythm: 'Spatial rhythm and layout grid',
    // Type scale role translations
    caption: 'caption',
    'body-sm': 'body-sm',
    body: 'body',
    subheading: 'subheading',
    'heading-sm': 'heading-sm',
    heading: 'heading',
    'heading-lg': 'heading-lg',
    display: 'display',
    'body-lg': 'body-lg',
    uiComponents: 'UI components used in this design',
    agentPromptGuide: 'Agent Prompt Guide',
    // Right panel
    designMd: 'DESIGN.md',
    tailwindV4: 'Tailwind v4',
    cssVariables: 'CSS Variables',
    designTokens: 'Design Tokens',
    styleDictionary: 'Style Dict',
    copy: 'Copy',
    copied: 'Copied!',
    download: 'Download',
    // Figma Comparison
    figmaComparison: 'Figma Comparison',
    figmaUrlPlaceholder: 'Paste Figma file URL...',
    compareWithFigma: 'Compare with Figma',
    compareBtn: 'Compare',
    comparing: 'Comparing...',
    matchRate: 'Match Rate',
    matched: 'Matched',
    missing: 'Missing',
    undefined: 'Undefined',
    colors: 'Colors',
    typography: 'Typography',
    shadows: 'Shadows',
    animation: 'Animation',
    animationTiming: 'Animation Timing',
    animationEasing: 'Animation Easing',
    // Preview
    visitSite: 'Visit site',
  },
  zh: {
    // Nav
    styles: '样式库',
    apiCta: '在 agent 中调用 API',
    apiCtaLink: '获取 API Key →',
    // Section titles
    colorPalette: '色彩',
    typography: '字体',
    typeScale: '字号',
    gradients: '渐变',
    elevationPhilosophy: '层次理念',
    spacing: '间距',
    surfaces: '表面色',
    shapes: '圆角',
    imagery: '图片风格',
    layout: '布局',
    dosDonts: '规范',
    components: '组件',
    customSections: '自定义区块',
    // Sub-labels
    fontFamiliesUsed: '网站使用的字体',
    minorThirdBase: 'Minor Third · 基础 20px',
    photographyStyle: '摄影和插图风格',
    gridSystem: '网格系统和结构决策',
    borderRadiusTokens: '圆角和角落标记',
    surfaceTones: '卡片、弹窗和面板背景色',
    spatialRhythm: '空间节奏和布局网格',
    // Type scale role translations (API data, displayed as UI)
    caption: '标签',
    'body-sm': '正文小',
    body: '正文',
    subheading: '副标题',
    'heading-sm': '标题小',
    heading: '标题',
    'heading-lg': '标题大',
    display: '展示',
    'body-lg': '正文大',
    uiComponents: '设计中使用的 UI 组件',
    agentPromptGuide: 'AI 提示词指南',
    // Right panel
    designMd: '设计文档',
    tailwindV4: 'Tailwind v4',
    cssVariables: 'CSS 变量',
    designTokens: '设计令牌',
    styleDictionary: 'Style Dict',
    copy: '复制',
    copied: '已复制！',
    download: '下载',
    // Figma Comparison
    figmaComparison: 'Figma 对比',
    figmaUrlPlaceholder: '粘贴 Figma 文件 URL...',
    compareWithFigma: '对比 Figma',
    compareBtn: '对比',
    comparing: '对比中...',
    matchRate: '匹配率',
    matched: '匹配',
    missing: '缺失',
    undefined: '未定义',
    colors: '颜色',
    typography: '字体',
    shadows: '阴影',
    animation: '动效',
    animationTiming: '动效时间',
    animationEasing: '缓动函数',
    // Preview
    visitSite: '访问网站',
  }
};

export default function StylePage() {
  const params = useParams();
  const id = params?.id;

  const [card, setCard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(null);
  const [locale, setLocale] = useState('en');
  useEffect(() => {
    setLocale(navigator.language.startsWith('zh') ? 'zh' : 'en');
  }, []);
  const [fontPreview, setFontPreview] = useState('The quick brown fox jumps over the lazy dog');
  const [exportFormat, setExportFormat] = useState('CSS Variables');
  const [rightTab, setRightTab] = useState('DESIGN.md');
  // Figma comparison state
  const [figmaUrl, setFigmaUrl] = useState('');
  const [figmaLoading, setFigmaLoading] = useState(false);
  const [figmaError, setFigmaError] = useState(null);
  const [comparison, setComparison] = useState(null);
  // Mobile: toggle code panel
  const [showCodePanel, setShowCodePanel] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function load() {
      try {
        const res = await fetch(`/api/card/${id}`);
        if (!res.ok) throw new Error('Not found');
        const data = await res.json();
        setCard(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function compareWithFigma() {
    if (!figmaUrl.trim()) {
      setFigmaError(locale === 'zh' ? '请输入 Figma URL' : 'Please enter Figma URL');
      return;
    }
    setFigmaLoading(true);
    setFigmaError(null);
    try {
      const res = await fetch(`/api/comparison?cardId=${id}&figmaUrl=${encodeURIComponent(figmaUrl)}`);
      const data = await res.json();
      if (!data.success) {
        setFigmaError(data.error || 'Comparison failed');
      } else {
        setComparison(data.comparison);
      }
    } catch (e) {
      setFigmaError(e.message);
    } finally {
      setFigmaLoading(false);
    }
  }

  async function copyText(text, key) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key || text);
      setTimeout(() => setCopied(null), 1800);
    } catch {}
  }

  if (loading) {
    return (
      <div className="detail-page">
        <div className="detail-nav">
          <div className="skeleton-nav" />
        </div>
        <div className="detail-main">
          <div className="detail-content">
            <div className="detail-content-inner">
              <div className="skeleton-preview" />
              <div className="skeleton-title" />
              <div className="skeleton-colors">
                {[1,2,3,4].map(i => <div key={i} className="skeleton-color-card" />)}
              </div>
              <div className="skeleton-fonts">
                {[1,2].map(i => <div key={i} className="skeleton-font-item" />)}
              </div>
            </div>
          </div>
          <div className="detail-deco-col">
            <div className="skeleton-code-panel" />
          </div>
        </div>
        <style>{`
          .skeleton-nav { height: 80px; background: var(--bg); border-bottom: 1px solid var(--border); animation: skeleton-pulse 1.5s ease-in-out infinite; }
          .skeleton-preview { height: 280px; background: var(--bg-card); border-radius: 12px; margin-bottom: 32px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
          .skeleton-title { height: 36px; width: 60%; background: var(--bg-card); border-radius: 6px; margin-bottom: 16px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
          .skeleton-colors { display: flex; gap: 10px; margin-bottom: 24px; }
          .skeleton-color-card { width: 120px; height: 100px; background: var(--bg-card); border-radius: 8px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
          .skeleton-color-card:nth-child(2) { animation-delay: 0.1s; }
          .skeleton-color-card:nth-child(3) { animation-delay: 0.2s; }
          .skeleton-color-card:nth-child(4) { animation-delay: 0.3s; }
          .skeleton-fonts { display: flex; flex-direction: column; gap: 16px; }
          .skeleton-font-item { height: 80px; background: var(--bg-card); border-radius: 8px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
          .skeleton-font-item:nth-child(2) { animation-delay: 0.2s; }
          .skeleton-code-panel { height: 100%; margin: 16px; background: var(--bg-card); border-radius: 12px; animation: skeleton-pulse 1.5s ease-in-out infinite; }
          @keyframes skeleton-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        `}</style>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="detail-error">
        <p>{locale === 'zh' ? '卡片未找到。' : 'Card not found.'}</p>
        <Link href="/">{locale === 'zh' ? '← 返回图库' : '← Back to gallery'}</Link>
      </div>
    );
  }

  const colors = (() => {
    try { return JSON.parse(card.colors || '[]'); } catch { return []; }
  })();

  const fonts = (() => {
    if (!card.fonts) return [];
    try {
      const parsed = JSON.parse(card.fonts);
      // fonts 可能是字符串描述，也可能是对象数组
      if (typeof parsed === 'string') return [{ fontFamily: parsed }];
      if (Array.isArray(parsed)) {
        return parsed.map(f => typeof f === 'string' ? { fontFamily: f } : f);
      }
      return [{ fontFamily: String(parsed) }];
    } catch { return []; }
  })();

  const typeScale = (() => {
    if (!card.type_scale) return null;
    try {
      const parsed = JSON.parse(card.type_scale);
      // 如果是数组，说明没有 name/steps 包装，直接作为 steps
      if (Array.isArray(parsed)) return { steps: parsed };
      return parsed;
    } catch { return null; }
  })();

  const gradients = (() => {
    if (!card.gradient) return [];
    try {
      const parsed = JSON.parse(card.gradient);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  const rawData = (() => {
    if (!card.raw_data) return {};
    try { return JSON.parse(card.raw_data); } catch { return {}; }
  })();
  // 多格式导出数据（优先使用服务端预生成，兜底客户端生成）
  const tokensJson = rawData.tokensJson || '';
  const variablesCss = rawData.variablesCss || '';
  const themeCss = rawData.themeCss || '';
  // imagery/layout can be array, object, or plain string description — handle all cases
  const imageryData = (() => {
    const val = rawData?.designSystem?.imagery;
    if (!val) return null;
    if (Array.isArray(val)) return { type: 'array', data: val };
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return { type: 'array', data: parsed };
        return { type: 'text', data: val }; // JSON parsed to non-array, treat original as text
      } catch {
        return { type: 'text', data: val }; // plain text description
      }
    }
    return null;
  })();
  const layoutData = (() => {
    const val = rawData?.designSystem?.layout;
    if (!val) return null;
    if (typeof val === 'string') {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) return { type: 'array', data: parsed };
        if (typeof parsed === 'object' && parsed !== null) return { type: 'object', data: parsed };
        return { type: 'text', data: val };
      } catch {
        return { type: 'text', data: val };
      }
    }
    if (Array.isArray(val)) return { type: 'array', data: val };
    if (typeof val === 'object' && val !== null) return { type: 'object', data: val };
    return null;
  })();
  const ds = (() => {
    const base = rawData?.designSystem || {};
    const safeParse = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { const p = JSON.parse(val); return Array.isArray(p) ? p : null; } catch { return null; }
      }
      return val;
    };
    return {
      ...base,
      components: safeParse(base.components) || [],
      surfaces: safeParse(base.surfaces) || [],
      customSections: safeParse(base.customSections) || [],
      dos: safeParse(base.dos) || [],
      donts: safeParse(base.donts) || [],
      spacing: typeof base.spacing === 'string' ? (() => { try { return JSON.parse(base.spacing); } catch { return {}; } })() : (base.spacing || {}),
    };
  })();
  const raw = (() => {
    const base = rawData?.raw || {};
    const safeParse = (val) => {
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { const p = JSON.parse(val); return p; } catch { return null; }
      }
      return val;
    };
    return {
      ...base,
      shapes: safeParse(base.shapes) || {},
      gradients: safeParse(base.gradients) || [],
    };
  })();

  // Animations from raw_data.animations
  const animations = (() => {
    const rawAnim = rawData?.animations;
    if (!rawAnim) return null;
    if (typeof rawAnim === 'string') {
      try { return JSON.parse(rawAnim); } catch { return null; }
    }
    return rawAnim;
  })();

  // New fields
  const cssVariables = (() => {
    if (!card.css_variables) return {};
    try { return typeof card.css_variables === 'string' ? JSON.parse(card.css_variables) : card.css_variables; } catch { return {}; }
  })();

  const breakpoints = (() => {
    if (!card.breakpoints) return [];
    try { return typeof card.breakpoints === 'string' ? JSON.parse(card.breakpoints) : card.breakpoints; } catch { return []; }
  })();

  const spacingBase = card.spacing_base || null;

  const dos = (() => {
    if (!card.dos) return [];
    try { return typeof card.dos === 'string' ? JSON.parse(card.dos) : card.dos; } catch { return []; }
  })();

  const donts = (() => {
    if (!card.donts) return [];
    try { return typeof card.donts === 'string' ? JSON.parse(card.donts) : card.donts; } catch { return []; }
  })();

  const catStyle = CATEGORY_COLORS[card.category?.toLowerCase()] || CATEGORY_COLORS.minimal;
  const schemeClass = card.color_scheme === 'dark' ? 'scheme-dark' : 'scheme-light';

  function getDesignMd() {
    return designMd(card, colors, fonts, typeScale, breakpoints, spacingBase, dos, donts, ds);
  }

  function toCssName(name) {
    return exportUtil(name);
  }

  function getFormatCode(fmt) {
    return formatCode(fmt, colors, gradients, fonts, typeScale, card, variablesCss, themeCss, tokensJson);
  }

  function getStyleDictionary() {
    return styleDict(colors, fonts, ds, raw, card);
  }

  function getExportCode() {
    return exportCode(exportFormat, colors, gradients, fonts, typeScale, card, variablesCss, themeCss, tokensJson, ds, raw);
  }

  return (
    <div className={`detail-page ${schemeClass}`}>
      {/* Nav — matches refero.design 80px banner */}
      <div className="detail-nav">
        <Link href="/" className="detail-back">
          <BackIcon />
          <span>{T[locale].styles}</span>
        </Link>
        <span className="detail-nav-sep">/</span>
        <span className="detail-nav-name">{card.name}</span>
        <div className="detail-nav-lang">
          <button
            className={`lang-btn ${locale === 'en' ? 'active' : ''}`}
            onClick={() => setLocale('en')}
          >EN</button>
          <button
            className={`lang-btn ${locale === 'zh' ? 'active' : ''}`}
            onClick={() => setLocale('zh')}
          >中文</button>
        </div>
      </div>

      {/* Main content area — matches refero.design */}
      <div className="detail-main">
        <div className="detail-content">
          <div className="detail-content-inner">

          {/* Preview */}
          <div className="detail-preview">
            {card.video_url ? (
              <video src={card.video_url} autoPlay loop muted playsInline className="detail-media" />
            ) : card.screenshot ? (
              <img src={card.screenshot} alt={card.name} className="detail-media" />
            ) : (
              <div className="detail-media-placeholder"><span>No preview</span></div>
            )}
          </div>

          {/* Header */}
          <div className="detail-header">
            <div className="detail-title-row">
              <h1 className="detail-title">{card.name}</h1>
              <span className="detail-category-badge" style={{ background: catStyle.accent + '18', color: catStyle.accent }}>
                {card.category}
              </span>
            </div>
            {card.north_star && <p className="detail-north-star">{card.north_star}</p>}
            {card.url && (
              <a href={card.url} target="_blank" rel="noopener noreferrer" className="detail-origin-link">
                <ExternalIcon />
                {card.url.replace(/^https?:\/\//, '')}
              </a>
            )}
          </div>

          <div className="detail-api-cta">
            <span>{T[locale].apiCta}</span>
            <Link href="/dashboard">{T[locale].apiCtaLink}</Link>
          </div>

          {/* Colors */}
          {colors.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].colorPalette}</h2>
              <div className="color-grid">
                {colors.map((c, i) => (
                  <button key={i} className="color-swatch" onClick={() => copyText(c.hex)} title={`Copy ${c.hex}`}>
                    <div className="swatch-block" style={{ background: c.hex }} />
                    <div className="swatch-info">
                      <span className="swatch-name">{typeof c.name === 'string' ? c.name : JSON.stringify(c.name)}</span>
                      <span className="swatch-hex">{c.hex}</span>
                      {copied === c.hex
                        ? <span className="swatch-copied"><CheckIcon /> {T[locale].copied}</span>
                        : <span className="swatch-copy"><CopyIcon /> {T[locale].copy}</span>
                      }
                      {c.role && <span className="swatch-role">{c.role}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Typography */}
          {fonts.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].typography}</h2>
              <p className="detail-section-sub">{T[locale].fontFamiliesUsed}</p>
              <div className="font-list">
                {fonts.map((f, i) => (
                  <div key={i} className="font-item">
                    {f.fontFamily ? (
                      <>
                        <div className="font-meta-row">
                          <span className="font-name">{f.fontFamily}</span>
                          {f.weights && <span className="font-meta">{f.weights.join(', ')}</span>}
                        </div>
                        {f.desc && <p className="font-desc">{f.desc}</p>}
                        <p className="font-sample" style={{ fontFamily: `"${f.fontFamily}", sans-serif` }}>{fontPreview}</p>
                      </>
                    ) : (
                      <p className="font-desc">{f.desc || String(f)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Type Scale */}
          {typeScale && typeScale.steps && typeScale.steps.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].typeScale}</h2>
              <p className="detail-section-sub">{locale === 'zh' ? '比例：' : ''}{typeScale.name || 'Custom Scale'}{typeScale.base ? ` · Base ${typeScale.base}px` : ''}</p>
              <div className="type-scale-list">
                {typeScale.steps.slice(0, 8).map((step, i) => (
                  <div key={i} className="type-scale-item">
                    <div className="type-scale-meta">
                      <span className="type-scale-role">{T[locale][step.role] || step.role}</span>
                      <span className="type-scale-size">{step.size}{locale === 'zh' ? '像素' : 'px'}</span>
                    </div>
                    <p className="type-scale-sample" style={{ fontSize: Math.min(step.size, 72) + 'px', lineHeight: step.lineHeight || 1.2, letterSpacing: step.letterSpacing ? step.letterSpacing + 'em' : 'normal', fontWeight: step.weight || 400 }}>
                      Aa
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Gradients */}
          {gradients.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].gradients}</h2>
              <div className="gradient-list">
                {gradients.map((g, i) => (
                  <div key={i} className="gradient-item">
                    <div className="gradient-swatch" style={{ background: g.css || g.value || g }} />
                    <span className="gradient-css">{g.css || g.value || g}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Elevation Philosophy */}
          {(card.elevation_philosophy || ds.elevationPhilosophy) && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].elevationPhilosophy}</h2>
              <p className="detail-philosophy">{card.elevation_philosophy || ds.elevationPhilosophy}</p>
            </section>
          )}

          {/* Spacing */}
          {ds.spacing && Object.keys(ds.spacing).length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].spacing}</h2>
              <p className="detail-section-sub">{T[locale].spatialRhythm}</p>
              <div className="spacing-grid">
                {ds.spacing != null && Object.entries(ds.spacing).map(([key, val]) => (
                  <div key={key} className="spacing-item">
                    <span className="spacing-key">{key}</span>
                    {typeof val === 'object' && !Array.isArray(val) ? (
                      <div className="spacing-nested">
                        {val != null ? Object.entries(val).map(([k, v]) => (
                          <span key={k} className="spacing-sub-item">
                            <span className="spacing-sub-key">{k}:</span>
                            <span className="spacing-sub-val">{String(v)}</span>
                          </span>
                        )) : null}
                      </div>
                    ) : (
                      <span className="spacing-val">{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Surfaces */}
          {ds.surfaces && ds.surfaces.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].surfaces}</h2>
              <p className="detail-section-sub">{T[locale].surfaceTones}</p>
              <div className="surface-list">
                {ds.surfaces.map((s, i) => (
                  <div key={i} className="surface-item">
                    {(s.hex || s.color) && <div className="surface-swatch" style={{ background: s.hex || s.color }} />}
                    <div className="surface-info">
                      <span className="surface-name">{s.name || s.token || `Surface ${i + 1}`}</span>
                      {(s.hex || s.color) && <span className="surface-hex">{s.hex || s.color}</span>}
                      {s.purpose && <span className="surface-desc">{s.purpose}</span>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Animation */}
          {animations && (animations.durationTokens?.tokens || animations.easings) && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].animation}</h2>
              {animations.durationTokens?.tokens && Object.keys(animations.durationTokens.tokens).length > 0 && (
                <>
                  <h3 className="detail-section-subtitle">{T[locale].animationTiming}</h3>
                  <div className="animation-grid">
                    {Object.entries(animations.durationTokens.tokens).map(([key, value]) => (
                      <div key={key} className="animation-item">
                        <div className="animation-preview" style={{ animationDuration: value }} />
                        <span className="animation-key">{key}</span>
                        <span className="animation-val">{value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {animations.easings && Object.keys(animations.easings).length > 0 && (
                <>
                  <h3 className="detail-section-subtitle" style={{marginTop: 16}}>{T[locale].animationEasing}</h3>
                  <div className="animation-grid">
                    {Object.entries(animations.easings).slice(0, 6).map(([key, val]) => (
                      <div key={key} className="animation-item">
                        <div className="animation-preview" style={{ transitionTimingFunction: key }} />
                        <span className="animation-key">{key}</span>
                        <span className="animation-val">{key}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Shapes */}
          {raw.shapes && Object.keys(raw.shapes).length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].shapes}</h2>
              <p className="detail-section-sub">{T[locale].borderRadiusTokens}</p>
              {raw.shapes.radii && raw.shapes.radii.length > 0 && (
                <>
                  <h3 className="detail-section-subtitle">{locale === 'zh' ? '圆角半径' : 'Border Radii'}</h3>
                  <div className="shapes-grid">
                    {raw.shapes.radii.map((r, i) => (
                      <div key={i} className="shape-item">
                        <div className="shape-preview" style={{ borderRadius: r.value >= 100 ? '50%' : `${r.value}px`, width: r.value >= 100 ? 40 : Math.min(r.value * 1.5, 60), height: r.value >= 100 ? 40 : Math.min(r.value * 1.5, 60) }} />
                        <span className="shape-val">{r.value >= 100 ? 'circle' : `${r.value}px`}</span>
                        <span className="shape-context">{r.contexts?.join(', ')}</span>
                        <span className="shape-freq">{r.frequency}x</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {raw.shapes.shadows && raw.shapes.shadows.length > 0 && (
                <>
                  <h3 className="detail-section-subtitle" style={{marginTop: 16}}>{locale === 'zh' ? '阴影' : 'Shadows'}</h3>
                  <div className="shapes-grid">
                    {raw.shapes.shadows.map((s, i) => (
                      <div key={i} className="shape-item">
                        <div className="shape-preview" style={{ boxShadow: typeof s === 'string' ? s : s.value || s.shadow }} />
                        <span className="shape-val">{typeof s === 'string' ? s.substring(0, 30) : (s.value || '').substring(0, 30)}</span>
                        {s.contexts && <span className="shape-context">{s.contexts.join(', ')}</span>}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          {/* Imagery */}
          {imageryData && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].imagery}</h2>
              <p className="detail-section-sub">{T[locale].photographyStyle}</p>
              {imageryData.type === 'array' ? (
                <div className="imagery-list">
                  {imageryData.data.slice(0, 12).map((img, i) => (
                    <div key={i} className="imagery-item">
                      {img.url && <img src={img.url} alt={img.alt || img.style || ''} className="imagery-thumb" loading="lazy" />}
                      <div className="imagery-info">
                        {img.style && <span className="imagery-style">{img.style}</span>}
                        {img.alt && <span className="imagery-alt">{img.alt}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-text-block">{imageryData.data}</p>
              )}
            </section>
          )}

          {/* Layout */}
          {layoutData && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].layout}</h2>
              <p className="detail-section-sub">{T[locale].gridSystem}</p>
              {layoutData.type === 'text' ? (
                <p className="detail-text-block">{layoutData.data}</p>
              ) : layoutData.type === 'array' ? (
                <div className="layout-grid">
                  {layoutData.data.slice(0, 20).map((item, i) => (
                    <div key={i} className="layout-item">
                      <span className="layout-key">{item.name || item.label || `Section ${i + 1}`}</span>
                      <span className="layout-val">{item.value || JSON.stringify(item)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="layout-grid">
                  {Object.entries(layoutData.data || {}).slice(0, 20).map(([key, val]) => (
                    <div key={key} className="layout-item">
                      <span className="layout-key">{key}</span>
                      <span className="layout-val">{typeof val === 'object' ? JSON.stringify(val) : String(val)}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Dos & Don'ts */}
          {(ds.dos?.length > 0 || ds.donts?.length > 0) && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].dosDonts}</h2>
              <div className="dos-donts">
                {ds.dos?.length > 0 && (
                  <div className="dos-column">
                    <div className="dos-header"><span className="dos-icon">&#10003;</span><span>Do</span></div>
                    <ul className="dos-list">{ds.dos.map((d, i) => <li key={i} className="dos-item">{d}</li>)}</ul>
                  </div>
                )}
                {ds.donts?.length > 0 && (
                  <div className="donts-column">
                    <div className="donts-header"><span className="donts-icon">&#10005;</span><span>Don't</span></div>
                    <ul className="donts-list">{ds.donts.map((d, i) => <li key={i} className="donts-item">{d}</li>)}</ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Components */}
          {ds.components && ds.components.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].components}</h2>
              <p className="detail-section-sub">{T[locale].uiComponents}</p>
              <div className="components-grid">
                {ds.components.map((comp, i) => (
                  <div key={i} className="component-item">
                    {comp.screenshot && <img src={comp.screenshot} alt={comp.name || comp.type || `Component ${i + 1}`} className="component-screenshot" loading="lazy" />}
                    <div className="component-info">
                      <span className="component-name">{comp.name || comp.type || `Component ${i + 1}`}</span>
                      {comp.variant && <span className="component-variant">{comp.variant}</span>}
                      {comp.description && <span className="component-desc">{comp.description}</span>}
                      {comp.html && (
                        <details className="component-html-details">
                          <summary className="component-html-summary">HTML</summary>
                          <pre className="component-html">{comp.html}</pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* CSS Variables */}
          {Object.keys(cssVariables).length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">CSS Variables</h2>
              <div className="spacing-grid">
                {Object.entries(cssVariables).slice(0, 20).map(([key, val]) => (
                  <div key={key} className="spacing-item">
                    <span className="spacing-key" style={{fontSize:'10px'}}>{key}</span>
                    <span className="spacing-val">{typeof val === 'string' && val.length > 40 ? val.substring(0, 40) + '...' : String(val)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Breakpoints */}
          {breakpoints.length > 0 && (
            <section className="detail-section">
              <h2 className="detail-section-title">{locale === 'zh' ? '响应式断点' : 'Breakpoints'}</h2>
              <div className="spacing-grid">
                {breakpoints.map((bp, i) => (
                  <div key={i} className="spacing-item">
                    <span className="spacing-key">{bp}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Spacing Base */}
          {spacingBase && (
            <section className="detail-section">
              <h2 className="detail-section-title">{locale === 'zh' ? '基础网格' : 'Spacing Grid'}</h2>
              <div className="detail-text-block">{locale === 'zh' ? `基础网格单位: ${spacingBase}` : `Base grid unit: ${spacingBase}`}</div>
            </section>
          )}

          {/* Do's & Don'ts */}
          {(dos.length > 0 || donts.length > 0) && (
            <section className="detail-section">
              <h2 className="detail-section-title">{T[locale].dosDonts}</h2>
              <div className="dos-donts">
                {dos.length > 0 && (
                  <div className="dos-column">
                    <div className="dos-header"><span className="dos-icon">&#10003;</span><span>Do</span></div>
                    <ul className="dos-list">{dos.map((d, i) => <li key={i} className="dos-item">{d}</li>)}</ul>
                  </div>
                )}
                {donts.length > 0 && (
                  <div className="donts-column">
                    <div className="donts-header"><span className="donts-icon">&#10005;</span><span>Don't</span></div>
                    <ul className="donts-list">{donts.map((d, i) => <li key={i} className="donts-item">{d}</li>)}</ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Figma Comparison */}
          <section className="detail-section">
            <h2 className="detail-section-title">{T[locale].figmaComparison}</h2>
            <div className="figma-compare">
              <div className="figma-input-row">
                <input
                  type="text"
                  className="figma-url-input"
                  placeholder={T[locale].figmaUrlPlaceholder}
                  value={figmaUrl}
                  onChange={(e) => setFigmaUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && compareWithFigma()}
                />
                <button
                  className="figma-compare-btn"
                  onClick={compareWithFigma}
                  disabled={figmaLoading}
                >
                  {figmaLoading ? T[locale].comparing : T[locale].compareBtn}
                </button>
              </div>
              {figmaError && (
                <div className="figma-error">{figmaError}</div>
              )}
              {comparison && (
                <div className="comparison-result">
                  <div className="comparison-summary">
                    <div className="match-rate">
                      <span className="match-rate-label">{T[locale].matchRate}:</span>
                      <span className="match-rate-value">{comparison.summary.matchRate}%</span>
                    </div>
                    <div className="comparison-stats">
                      <span className="stat-matched">{comparison.summary.matched} {T[locale].matched}</span>
                      <span className="stat-missing">{comparison.summary.missing} {T[locale].missing}</span>
                      <span className="stat-undefined">{comparison.summary.undefined} {T[locale].undefined}</span>
                    </div>
                  </div>
                  {comparison.colors.missing.length > 0 && (
                    <div className="comparison-section">
                      <h4>{T[locale].colors} - {T[locale].missing}</h4>
                      <div className="comparison-items">
                        {comparison.colors.missing.map((c, i) => (
                          <div key={i} className="comparison-item missing">
                            <span className="color-swatch-small" style={{ background: c.hex }} />
                            <span className="color-hex">{c.hex || c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {comparison.colors.undefined.length > 0 && (
                    <div className="comparison-section">
                      <h4>{T[locale].colors} - {T[locale].undefined}</h4>
                      <div className="comparison-items">
                        {comparison.colors.undefined.map((c, i) => (
                          <div key={i} className="comparison-item undefined">
                            <span className="color-hex">{c.name || c.hex}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Mobile: Code Panel Toggle */}
          <div className="mobile-code-toggle">
            <button className="mobile-code-btn" onClick={() => setShowCodePanel(true)}>
              <CodeIcon /> {locale === 'zh' ? '查看代码' : 'View Code'}
            </button>
          </div>

          </div>
        </div>

        {/* RIGHT: Tabbed Code Panel — matches refero.design */}
        <div className={`detail-deco-col ${showCodePanel ? 'open' : ''}`}>
          {/* Mobile close button */}
          <button className="mobile-close-btn" onClick={() => setShowCodePanel(false)}>
            <CloseIcon />
          </button>
          <div className="right-card">
            <div className="right-panel">
            <div className="right-panel-tabs">
              {[
                { key: 'DESIGN.md', label: T[locale].designMd },
                { key: 'TAILWIND', label: T[locale].tailwindV4 },
                { key: 'CSS', label: T[locale].cssVariables },
                { key: 'TOKENS', label: T[locale].designTokens },
                { key: 'STYLE_DICT', label: T[locale].styleDictionary },
              ].map(tab => (
                <button key={tab.key} className={`right-tab${rightTab === tab.key ? ' active' : ''}`} onClick={() => setRightTab(tab.key)}>
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="right-panel-content">
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                <button className="right-copy-btn" onClick={() => copyText(rightTab === 'DESIGN.md' ? getDesignMd() : (rightTab === 'STYLE_DICT' ? getStyleDictionary() : getFormatCode(rightTab === 'TAILWIND' ? 'Tailwind v4' : rightTab === 'CSS' ? 'CSS Variables' : 'Design Tokens')), 'export')}>
                  <CopyIcon /> {T[locale].copy}
                </button>
                <button className="right-copy-btn" onClick={() => {
                  const content = rightTab === 'DESIGN.md' ? getDesignMd() : (rightTab === 'STYLE_DICT' ? getStyleDictionary() : getFormatCode(rightTab === 'TAILWIND' ? 'Tailwind v4' : rightTab === 'CSS' ? 'CSS Variables' : 'Design Tokens'));
                  const name = card?.name || 'design';
                  const filenames = { 'DESIGN.md': `${name}.md`, 'TAILWIND': `${name}.theme.css`, 'CSS': `${name}.variables.css`, 'TOKENS': `${name}.tokens.json`, 'STYLE_DICT': `${name}.style-dictionary.json` };
                  const mime = rightTab === 'Design Tokens' || rightTab === 'STYLE_DICT' ? 'application/json' : 'text/plain';
                  const blob = new Blob([content], { type: mime });
                  const a = document.createElement('a');
                  a.href = URL.createObjectURL(blob);
                  a.download = filenames[rightTab] || `${name}.txt`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}>
                  <DownloadIcon /> {T[locale].download}
                </button>
              </div>
              <pre className="right-code">
                {rightTab === 'DESIGN.md' ? getDesignMd() : (rightTab === 'STYLE_DICT' ? getStyleDictionary() : getFormatCode(rightTab === 'TAILWIND' ? 'Tailwind v4' : rightTab === 'CSS' ? 'CSS Variables' : 'Design Tokens'))}
              </pre>
            </div>
          </div>
          </div>
        </div>

      </div>

      <style>{`
        .detail-page {
          position: fixed;
          inset: 0;
          display: flex;
          flex-direction: column;
          background: var(--bg);
          color: var(--text);
          font-family: var(--font-sans);
          z-index: 100;
        }
        .detail-nav {
          flex-shrink: 0;
          height: 80px;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 0 32px;
          border-bottom: 1px solid var(--border);
          font-size: 13px;
          color: var(--text-dim);
          background: var(--bg);
        }
        .detail-back {
          display: flex;
          align-items: center;
          gap: 5px;
          color: var(--text-dim);
          text-decoration: none;
          transition: color 0.15s;
        }
        .detail-back:hover { color: var(--accent); }
        .detail-nav-sep { color: var(--text-muted); }
        .detail-nav-name { color: var(--text); font-weight: 500; }
        .detail-nav-lang {
          margin-left: auto;
          display: flex;
          gap: 4px;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 2px;
        }
        .lang-btn {
          padding: 4px 10px;
          border-radius: calc(var(--radius-md) - 2px);
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          background: transparent;
          border: none;
          cursor: pointer;
          transition: all 0.15s;
        }
        .lang-btn:hover { color: var(--text); }
        .lang-btn.active {
          background: var(--accent);
          color: #fff;
        }
        .detail-main {
          flex: 1;
          display: flex;
          overflow: hidden;
          min-height: 0;
        }
        .detail-content {
          width: 640px;
          flex-shrink: 0;
          overflow-y: auto;
          overscroll-behavior: contain;
        }
        .detail-content-inner {
          width: 552px;
          margin-left: auto;
          padding: 48px 40px 48px 40px;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }
        .detail-content-inner::-webkit-scrollbar { width: 4px; }
        .detail-content-inner::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
        .detail-content { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        .detail-deco-col {
          flex: 1;
          min-width: 0;
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        /* Hide mobile-only buttons by default on desktop */
        .mobile-close-btn, .mobile-code-toggle { display: none !important; }
        .right-card {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
          border-radius: 16px;
          border: 1px solid var(--border);
          background: var(--bg-card);
          box-shadow: var(--shadow-card);
        }
        .right-panel {
          display: flex;
          flex-direction: column;
          height: 100%;
          overflow: hidden;
        }
        .right-panel-tabs {
          display: flex;
          gap: 2px;
          padding: 8px 16px;
          border-bottom: 1px solid var(--border);
          flex-shrink: 0;
          overflow-x: auto;
        }
        .right-tab {
          padding: 5px 10px;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-dim);
          background: transparent;
          border: 1px solid transparent;
          border-radius: var(--radius);
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.15s;
        }
        .right-tab:hover { color: var(--text); background: var(--bg-subtle); }
        .right-tab.active {
          color: var(--text);
          background: var(--bg);
          border-color: var(--border);
        }
        .right-panel-content {
          flex: 1;
          overflow: auto;
          padding: 16px;
          background: var(--bg-subtle);
        }
        .right-copy-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          margin: 0 0 12px 0;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          font-size: 12px;
          font-weight: 500;
          color: var(--text);
          cursor: pointer;
          transition: all 0.15s;
          width: fit-content;
        }
        .right-copy-btn:hover {
          border-color: var(--accent);
          color: var(--accent);
        }
        .right-code {
          font-family: var(--font-mono);
          font-size: 12px;
          line-height: 1.6;
          color: var(--text);
          white-space: pre-wrap;
          word-break: break-all;
          margin: 0;
        }
        .detail-preview {
          border-radius: var(--radius-lg);
          overflow: hidden;
          background: var(--bg-subtle);
          margin-bottom: 32px;
          border: 1px solid var(--border);
          aspect-ratio: 16/9;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .detail-media {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .detail-media-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          color: var(--text-muted);
          font-size: 13px;
        }
        .detail-header { margin-bottom: 36px; }
        .detail-api-cta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 28px;
          padding: 12px 16px;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg-card);
          font-size: 13px;
          color: var(--text-dim);
        }
        .detail-api-cta a {
          color: var(--accent);
          font-weight: 600;
          text-decoration: none;
          white-space: nowrap;
        }
        .detail-api-cta a:hover { text-decoration: underline; }
        .detail-title-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .detail-title {
          font-family: var(--font-display);
          font-size: 36px;
          font-weight: 700;
          letter-spacing: -0.025em;
          color: var(--text);
        }
        .detail-category-badge {
          font-size: 11px;
          font-weight: 600;
          padding: 4px 12px;
          border-radius: 999px;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }
        .detail-north-star {
          font-size: 14px;
          line-height: 1.7;
          color: var(--text-dim);
          margin-bottom: 12px;
          font-style: italic;
        }
        .detail-origin-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          font-size: 12px;
          color: var(--accent);
          text-decoration: none;
          font-family: var(--font-mono);
          transition: opacity 0.15s;
        }
        .detail-origin-link:hover { opacity: 0.75; }
        .detail-section { margin-bottom: 40px; }
        .detail-section-title {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: var(--text-muted);
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .detail-section-sub {
          font-size: 12px;
          color: var(--text-muted);
          margin-top: -8px;
          margin-bottom: 14px;
        }
        .detail-text-block {
          font-size: 13px;
          color: var(--text);
          line-height: 1.7;
          max-width: 600px;
          white-space: pre-wrap;
        }
        /* Colors */
        .color-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 10px;
        }
        .color-swatch {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          cursor: pointer;
          text-align: left;
          padding: 0;
          transition: border-color 0.15s, box-shadow 0.15s;
          font-family: var(--font-sans);
        }
        .color-swatch:hover {
          border-color: var(--accent);
          box-shadow: 0 2px 8px rgba(230,57,70,0.12);
        }
        .swatch-block { height: 60px; width: 100%; }
        .swatch-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
        .swatch-name { font-size: 12px; font-weight: 600; color: var(--text); }
        .swatch-hex { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
        .swatch-role { font-size: 10px; color: var(--text-muted); margin-top: 2px; line-height: 1.4; }
        .swatch-copy, .swatch-copied { display: flex; align-items: center; gap: 3px; font-size: 10px; margin-top: 3px; }
        .swatch-copy { color: var(--accent); }
        .swatch-copied { color: var(--green); }
        /* Fonts */
        .font-list { display: flex; flex-direction: column; gap: 16px; }
        .font-item { padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .font-name { font-size: 11px; font-weight: 600; font-family: var(--font-mono); color: var(--accent); letter-spacing: 0.04em; display: block; margin-bottom: 6px; }
        .font-sample { font-size: 22px; color: var(--text); line-height: 1.4; }
        .font-meta-row { display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px; }
        .font-meta { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }
        .font-desc { font-size: 12px; color: var(--text-dim); line-height: 1.6; font-style: italic; }
        /* Type Scale */
        .type-scale-list { display: flex; flex-direction: column; gap: 0; border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; }
        .type-scale-item { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid var(--border); gap: 16px; }
        .type-scale-item:last-child { border-bottom: none; }
        .type-scale-meta { display: flex; flex-direction: column; gap: 2px; min-width: 100px; }
        .type-scale-role { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); }
        .type-scale-size { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
        .type-scale-sample { color: var(--text); line-height: 1.1; font-family: var(--font-sans); flex: 1; text-align: right; overflow: hidden; white-space: nowrap; }
        /* Gradients */
        .gradient-list { display: flex; flex-direction: column; gap: 8px; }
        .gradient-item { display: flex; align-items: center; gap: 12px; }
        .gradient-swatch { width: 120px; height: 40px; border-radius: var(--radius-sm); flex-shrink: 0; border: 1px solid var(--border); }
        .gradient-css { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
        /* Philosophy */
        .detail-philosophy { font-size: 14px; line-height: 1.75; color: var(--text-dim); font-style: italic; padding: 16px; background: var(--bg-card); border-left: 3px solid var(--accent); border-radius: 0 var(--radius-md) var(--radius-md) 0; }
        /* Spacing */
        .spacing-grid { display: flex; flex-direction: column; gap: 6px; }
        .spacing-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .spacing-key { font-size: 11px; font-family: var(--font-mono); color: var(--accent); font-weight: 600; }
        .spacing-val { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
        .spacing-nested { display: flex; flex-direction: column; gap: 4px; }
        .spacing-sub-item { display: flex; gap: 8px; font-size: 11px; }
        .spacing-sub-key { font-family: var(--font-mono); color: var(--accent); }
        .spacing-sub-val { font-family: var(--font-mono); color: var(--text-muted); }
        /* Surfaces */
        .surface-list { display: flex; flex-direction: column; gap: 8px; }
        .surface-item { display: flex; align-items: center; gap: 12px; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .surface-swatch { width: 32px; height: 32px; border-radius: var(--radius-sm); flex-shrink: 0; border: 1px solid var(--border); }
        .surface-info { display: flex; flex-direction: column; gap: 2px; }
        .surface-name { font-size: 12px; font-weight: 600; color: var(--text); }
        .surface-hex { font-size: 11px; font-family: var(--font-mono); color: var(--text-muted); }
        .surface-desc { font-size: 11px; color: var(--text-dim); }
        /* Shapes */
        .shapes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 12px; }
        .shape-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .shape-preview { width: 48px; height: 48px; background: var(--accent); opacity: 0.7; border: 1px solid var(--border); }
        .shape-key { font-size: 10px; font-family: var(--font-mono); color: var(--accent); font-weight: 600; }
        .shape-val { font-size: 9px; font-family: var(--font-mono); color: var(--text-muted); }
        /* Imagery */
        .imagery-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
        .imagery-item { overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-card); }
        .imagery-thumb { width: 100%; aspect-ratio: 16/9; object-fit: cover; display: block; }
        .imagery-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
        .imagery-style { font-size: 11px; font-weight: 600; color: var(--accent); }
        .imagery-alt { font-size: 10px; color: var(--text-muted); }
        /* Layout */
        .layout-grid { display: flex; flex-direction: column; gap: 6px; }
        .layout-item { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .layout-key { font-size: 11px; color: var(--text-dim); }
        .layout-val { font-size: 11px; font-family: var(--font-mono); color: var(--accent); }
        /* Dos & Don'ts */
        .dos-donts { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .dos-header, .donts-header { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; margin-bottom: 10px; }
        .dos-icon { color: var(--green); font-size: 14px; }
        .donts-icon { color: var(--red); font-size: 14px; }
        .dos-list, .donts-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
        .dos-item, .donts-item { font-size: 12px; color: var(--text-dim); line-height: 1.5; padding: 8px 10px; border-radius: var(--radius-sm); }
        .dos-item { background: rgba(34,197,94,0.08); border-left: 2px solid var(--green); }
        .donts-item { background: rgba(239,68,68,0.08); border-left: 2px solid var(--red); }
        /* Components */
        .components-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
        .component-item { overflow: hidden; border-radius: var(--radius-md); border: 1px solid var(--border); background: var(--bg-card); }
        .component-screenshot { width: 100%; aspect-ratio: 4/3; object-fit: cover; display: block; }
        .component-info { padding: 8px 10px; display: flex; flex-direction: column; gap: 2px; }
        .component-name { font-size: 12px; font-weight: 600; color: var(--text); }
        .component-variant { font-size: 10px; color: var(--accent); font-family: var(--font-mono); }
        .component-desc { font-size: 10px; color: var(--text-muted); }
        /* Custom Sections */
        .custom-sections { display: flex; flex-direction: column; gap: 20px; }
        .custom-section-item { padding: 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .custom-section-title { font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 6px; }
        .custom-section-desc { font-size: 12px; color: var(--text-dim); line-height: 1.6; margin-bottom: 8px; }
        .custom-section-content { font-size: 12px; color: var(--text-dim); line-height: 1.6; }
        .custom-section-items { display: flex; flex-direction: column; gap: 4px; margin-top: 8px; }
        .custom-section-item-entry { display: flex; gap: 8px; font-size: 11px; }
        .cs-label { color: var(--accent); font-weight: 600; }
        .cs-value { font-family: var(--font-mono); color: var(--text); }
        .cs-desc { color: var(--text-muted); }
        /* Design Tokens Export */
        .export-tabs { display: flex; gap: 4px; margin-bottom: 12px; }
        .export-tab { padding: 6px 14px; border-radius: var(--radius-sm); font-size: 11px; font-weight: 600; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-muted); cursor: pointer; transition: all 0.15s; font-family: var(--font-sans); }
        .export-tab.active { background: var(--accent); color: white; border-color: var(--accent); }
        .export-code-wrap { border: 1px solid var(--border); border-radius: var(--radius-md); overflow: hidden; background: var(--bg-card); }
        .export-code-header { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--border); background: var(--bg-subtle); }
        .export-code-filename { font-size: 10px; font-family: var(--font-mono); color: var(--text-muted); }
        .export-copy-btn { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--accent); background: none; border: none; cursor: pointer; font-family: var(--font-sans); padding: 0; }
        .export-code { margin: 0; padding: 14px; font-size: 11px; font-family: var(--font-mono); color: var(--text-dim); overflow-x: auto; white-space: pre; max-height: 300px; overflow-y: auto; line-height: 1.6; }
        .detail-error { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; gap: 14px; color: var(--text-dim); font-size: 14px; }
        .detail-error a { color: var(--accent); text-decoration: none; }
        /* Figma Comparison */
        .figma-compare { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); padding: 16px; }
        .figma-input-row { display: flex; gap: 8px; margin-bottom: 12px; }
        .figma-url-input { flex: 1; padding: 8px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg); color: var(--text); font-size: 12px; font-family: var(--font-sans); }
        .figma-url-input:focus { outline: none; border-color: var(--accent); }
        .figma-compare-btn { padding: 8px 16px; background: var(--accent); color: white; border: none; border-radius: var(--radius-sm); font-size: 12px; font-weight: 600; cursor: pointer; font-family: var(--font-sans); transition: opacity 0.15s; }
        .figma-compare-btn:hover { opacity: 0.85; }
        .figma-compare-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .figma-error { color: var(--red); font-size: 12px; margin-bottom: 12px; padding: 8px; background: rgba(239,68,68,0.1); border-radius: var(--radius-sm); }
        .comparison-result { margin-top: 12px; }
        .comparison-summary { display: flex; align-items: center; justify-content: space-between; padding: 12px; background: var(--bg-subtle); border-radius: var(--radius-sm); margin-bottom: 12px; }
        .match-rate { display: flex; align-items: center; gap: 8px; }
        .match-rate-label { font-size: 12px; color: var(--text-dim); }
        .match-rate-value { font-size: 24px; font-weight: 700; color: var(--green); }
        .comparison-stats { display: flex; gap: 12px; font-size: 11px; }
        .stat-matched { color: var(--green); }
        .stat-missing { color: var(--orange); }
        .stat-undefined { color: var(--text-muted); }
        .comparison-section { margin-bottom: 12px; }
        .comparison-section h4 { font-size: 11px; font-weight: 600; color: var(--text-dim); margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em; }
        .comparison-items { display: flex; flex-wrap: wrap; gap: 6px; }
        .comparison-item { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: var(--radius-sm); font-size: 11px; }
        .comparison-item.missing { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); }
        .comparison-item.undefined { background: rgba(107,114,128,0.1); border: 1px solid rgba(107,114,128,0.3); }
        .color-swatch-small { width: 16px; height: 16px; border-radius: 4px; border: 1px solid var(--border); }
        .color-hex { font-family: var(--font-mono); color: var(--text); }
        /* Animation Section */
        .animation-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; margin-top: 12px; }
        .animation-item { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius-md); }
        .animation-preview { width: 100%; height: 32px; background: var(--accent-light); border-radius: 4px; }
        .animation-key { font-size: 11px; font-weight: 600; color: var(--text); font-family: var(--font-mono); }
        .animation-val { font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); }
        @media (max-width: 640px) {
          .detail-content { padding: 24px 16px 80px; }
          .detail-content-inner { width: 100%; padding: 24px 16px; }
          .detail-nav { padding: 12px 16px; height: 56px; }
          .detail-nav-sep, .detail-nav-name { display: none; }
          .color-grid { grid-template-columns: repeat(2, 1fr); }
          .dos-donts { grid-template-columns: 1fr; }
          .shapes-grid { grid-template-columns: repeat(2, 1fr); }
          .imagery-list { grid-template-columns: repeat(2, 1fr); }
          .components-grid { grid-template-columns: repeat(2, 1fr); }
          /* Hide mobile-only buttons on desktop */
          .mobile-close-btn, .mobile-code-toggle { display: none; }
          /* Mobile code panel */
          .detail-deco-col { display: none; position: fixed; inset: 0; z-index: 200; background: var(--bg); }
          .detail-deco-col.open { display: flex; flex-direction: column; }
          .mobile-close-btn { position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; }
          .mobile-code-toggle { position: fixed; bottom: 16px; left: 16px; right: 16px; z-index: 100; display: block; }
          .mobile-code-btn { width: 100%; padding: 12px 20px; background: var(--accent); color: white; border: none; border-radius: var(--radius-md); font-size: 14px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; cursor: pointer; box-shadow: var(--shadow-lg); }
        }
      `}</style>
    </div>
  );
}
