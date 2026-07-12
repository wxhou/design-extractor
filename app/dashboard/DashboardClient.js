'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';

const CURL_EXAMPLE = `curl -X POST https://url2design.com/api/v1/extract \\
  -H "Authorization: Bearer u2d_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://stripe.com"}'`;

function LogoMark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="5" height="5" rx="1" fill="white" opacity="0.9" />
      <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.6" />
      <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.6" />
      <rect x="9" y="9" width="5" height="5" rx="1" fill="white" opacity="0.3" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg
      className="provider-icon"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ display: 'block', flexShrink: 0 }}
    >
      <path
        fill="#181717"
        d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z"
      />
    </svg>
  );
}

async function parseJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export default function DashboardClient({ user, remainingCredits, hasStripeCustomer = false }) {
  const [keys, setKeys] = useState([]);
  const [keyName, setKeyName] = useState('');
  const [plaintext, setPlaintext] = useState(null);
  const [email, setEmail] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(Boolean(user));
  const [working, setWorking] = useState(false);
  const [billingWorking, setBillingWorking] = useState(false);
  const [error, setError] = useState(null);

  async function loadKeys() {
    if (!user) return;

    setLoading(true);
    setError(null);
    const response = await fetch('/api/dashboard/keys');
    const body = await parseJson(response);
    if (!response.ok) {
      setError(body?.error || '加载 API Key 失败');
      setLoading(false);
      return;
    }

    setKeys(Array.isArray(body) ? body : []);
    setLoading(false);
  }

  useEffect(() => {
    loadKeys();
  }, [user?.id]);

  async function createKey(event) {
    event.preventDefault();
    setWorking(true);
    setError(null);
    setPlaintext(null);

    const response = await fetch('/api/dashboard/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: keyName }),
    });
    const body = await parseJson(response);

    if (!response.ok) {
      setError(body?.error || '创建 API Key 失败');
      setWorking(false);
      return;
    }

    setPlaintext(body.plaintext);
    setKeys((current) => [body.key, ...current]);
    setKeyName('');
    setCopied(false);
    setWorking(false);
  }

  async function revokeKey(id) {
    if (!window.confirm('撤销此 API Key？正在使用它的集成将立即失效。')) {
      return;
    }

    setWorking(true);
    setError(null);
    const response = await fetch(`/api/dashboard/keys?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const body = await parseJson(response);

    if (!response.ok) {
      setError(body?.error || '撤销 API Key 失败');
      setWorking(false);
      return;
    }

    setKeys((current) => current.filter((key) => key.id !== id));
    setWorking(false);
  }

  async function copyPlaintext() {
    if (!plaintext) return;
    await navigator.clipboard.writeText(plaintext);
    setCopied(true);
  }

  async function startCheckout(plan) {
    setBillingWorking(true);
    setError(null);
    const response = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan }),
    });
    const body = await parseJson(response);
    if (!response.ok || !body?.url) {
      setError(body?.error || '无法发起结账');
      setBillingWorking(false);
      return;
    }
    window.location.assign(body.url);
  }

  async function manageBilling() {
    setBillingWorking(true);
    setError(null);
    const response = await fetch('/api/stripe/portal', { method: 'POST' });
    const body = await parseJson(response);
    if (!response.ok || !body?.url) {
      setError(body?.error || '无法打开账单门户');
      setBillingWorking(false);
      return;
    }
    window.location.assign(body.url);
  }

  function signInWithEmail(event) {
    event.preventDefault();
    if (!email.trim()) return;
    signIn('nodemailer', { email: email.trim(), callbackUrl: '/dashboard' });
  }

  return (
    <main className={`dashboard-page${!user ? ' is-login' : ''}`}>
      <div className="dashboard-grain" aria-hidden="true" />

      <section className="dashboard-shell">
        <header className="dashboard-topbar">
          <a className="dashboard-brand" href="/">
            <span className="dashboard-brand-icon">
              <LogoMark />
            </span>
            <span className="dashboard-brand-name">Url2Design</span>
          </a>
          {user && (
            <button
              type="button"
              className="dashboard-secondary dashboard-signout"
              onClick={() => signOut({ callbackUrl: '/dashboard' })}
            >
              退出登录
            </button>
          )}
        </header>

        {!user ? (
          <div className="dashboard-login-layout">
            <div className="dashboard-login-copy">
              <p className="dashboard-kicker">API Dashboard</p>
              <h1>登录以管理 API Key 与额度</h1>
              <p className="dashboard-subtitle">
                面向 agents 与开发者：创建 Key、查看 credits，调用 /api/v1/extract。
              </p>
            </div>

            <section className="dashboard-card dashboard-login" aria-labelledby="login-heading">
              <div className="dashboard-login-intro">
                <h2 id="login-heading">继续使用 Url2Design</h2>
                <p>选择下方方式登录。登录后即可创建 scoped API Key。</p>
              </div>

              <div className="dashboard-login-buttons">
                <button
                  type="button"
                  className="provider-btn provider-github"
                  onClick={() => signIn('github', { callbackUrl: '/dashboard' })}
                >
                  <GitHubIcon />
                  <span>使用 GitHub 继续</span>
                </button>
              </div>

              <div className="dashboard-divider" role="separator">
                <span>或使用邮箱</span>
              </div>

              <form className="dashboard-email-form" onSubmit={signInWithEmail}>
                <label className="visually-hidden" htmlFor="dashboard-email">
                  邮箱地址
                </label>
                <input
                  id="dashboard-email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                />
                <button type="submit" className="dashboard-email-submit">
                  发送魔法链接
                </button>
              </form>
            </section>
          </div>
        ) : (
          <>
            <div className="dashboard-hero">
              <p className="dashboard-kicker">API Dashboard</p>
              <h1>管理提取 API 的密钥与额度</h1>
              <p className="dashboard-subtitle">
                创建 scoped API Key。明文密钥仅在创建时显示一次。
              </p>
            </div>

            <div className="dashboard-grid">
              <section className="dashboard-card dashboard-account">
                <div className="dashboard-account-head">
                  {user.image ? (
                    <img className="dashboard-avatar" src={user.image} alt="" width={44} height={44} />
                  ) : (
                    <span className="dashboard-avatar dashboard-avatar-fallback" aria-hidden="true">
                      {(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div>
                    <p className="dashboard-label">已登录</p>
                    <h2>{user.name || user.email || 'API 用户'}</h2>
                    {user.email && user.name && <p>{user.email}</p>}
                  </div>
                </div>
                <div className="dashboard-stat">
                  <span>{remainingCredits ?? '—'}</span>
                  <p>剩余 credits</p>
                </div>
              </section>

              <section className="dashboard-card dashboard-billing">
                <div>
                  <p className="dashboard-label">账单</p>
                  <h2>升级 API 额度</h2>
                  <p>Starter 含每月 500 credits；Pro 含每月 2,000 credits。</p>
                </div>
                <div className="dashboard-billing-actions">
                  <button type="button" onClick={() => startCheckout('starter')} disabled={billingWorking}>
                    升级 Starter
                  </button>
                  <button type="button" onClick={() => startCheckout('pro')} disabled={billingWorking}>
                    升级 Pro
                  </button>
                  {hasStripeCustomer && (
                    <button
                      type="button"
                      className="dashboard-secondary"
                      onClick={manageBilling}
                      disabled={billingWorking}
                    >
                      管理账单
                    </button>
                  )}
                </div>
              </section>

              <section className="dashboard-card dashboard-key-panel">
                <div className="dashboard-card-header">
                  <div>
                    <p className="dashboard-label">API Keys</p>
                    <h2>创建与撤销密钥</h2>
                  </div>
                  <button type="button" className="dashboard-secondary" onClick={loadKeys} disabled={loading}>
                    刷新
                  </button>
                </div>

                <form className="dashboard-create-form" onSubmit={createKey}>
                  <input
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                    placeholder="密钥名称，例如 Production"
                  />
                  <button type="submit" disabled={working}>
                    创建 Key
                  </button>
                </form>

                {plaintext && (
                  <div className="dashboard-secret">
                    <div>
                      <strong>请立即复制此密钥，之后将无法再次查看。</strong>
                      <code>{plaintext}</code>
                    </div>
                    <button type="button" onClick={copyPlaintext}>
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                )}

                {error && <p className="dashboard-error">{error}</p>}

                <div className="dashboard-key-list">
                  {loading ? (
                    <p className="dashboard-empty">加载中…</p>
                  ) : keys.length === 0 ? (
                    <p className="dashboard-empty">还没有 API Key。创建一个即可调用 API。</p>
                  ) : (
                    keys.map((key) => (
                      <div className="dashboard-key-row" key={key.id}>
                        <div>
                          <strong>{key.name}</strong>
                          <p>
                            <code>{key.key_prefix}</code>
                            <span>创建于 {new Date(key.created_at).toLocaleDateString('zh-CN')}</span>
                            {key.last_used_at && (
                              <span>最近使用 {new Date(key.last_used_at).toLocaleDateString('zh-CN')}</span>
                            )}
                          </p>
                        </div>
                        <button type="button" onClick={() => revokeKey(key.id)} disabled={working}>
                          撤销
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="dashboard-card dashboard-example">
                <p className="dashboard-label">调用示例</p>
                <h2>从 URL 提取设计令牌</h2>
                <pre>
                  <code>{CURL_EXAMPLE}</code>
                </pre>
                <p className="dashboard-note">
                  本地测试 Stripe：stripe listen --forward-to localhost:3000/api/stripe/webhook
                </p>
              </section>
            </div>
          </>
        )}
      </section>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          padding: 28px 24px 72px;
          position: relative;
          background:
            radial-gradient(ellipse 70% 50% at 100% -10%, rgba(255, 59, 0, 0.12), transparent 55%),
            radial-gradient(ellipse 55% 45% at -5% 90%, rgba(10, 11, 13, 0.05), transparent 50%),
            linear-gradient(165deg, #f8f9fb 0%, var(--bg) 48%, #e8ebf0 100%);
        }

        .dashboard-grain {
          pointer-events: none;
          position: fixed;
          inset: 0;
          z-index: 0;
          opacity: 0.03;
          mix-blend-mode: multiply;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
        }

        .dashboard-shell {
          width: min(1080px, 100%);
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .dashboard-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 40px;
        }

        .dashboard-brand {
          display: inline-flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
          color: var(--text);
        }

        .dashboard-brand-icon {
          width: 36px;
          height: 36px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-ink);
          border-radius: 9px;
        }

        .dashboard-brand-name {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 700;
          letter-spacing: -0.03em;
        }

        .dashboard-signout {
          padding: 10px 14px !important;
          font-size: 13px !important;
        }

        .dashboard-kicker,
        .dashboard-label {
          color: var(--accent);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          margin-bottom: 10px;
          text-transform: uppercase;
        }

        .dashboard-hero {
          margin-bottom: 28px;
        }

        .dashboard-hero h1,
        .dashboard-login-copy h1 {
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(34px, 6.5vw, 56px);
          letter-spacing: -0.045em;
          line-height: 1.05;
          max-width: 18ch;
        }

        .dashboard-subtitle {
          color: var(--text-dim);
          font-size: 16px;
          margin-top: 16px;
          max-width: 34rem;
          line-height: 1.55;
        }

        .dashboard-login-layout {
          display: grid;
          gap: 40px;
          align-items: center;
          grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
          min-height: min(62vh, 560px);
          animation: dashIn 0.55s var(--ease-out) both;
        }

        .dashboard-login {
          display: grid;
          gap: 22px;
          padding: 28px;
          border-radius: var(--radius-lg);
          animation: dashIn 0.65s var(--ease-out) 0.08s both;
        }

        .dashboard-login-intro h2 {
          color: var(--text);
          font-family: var(--font-display);
          font-size: 26px;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }

        .dashboard-login-intro p {
          color: var(--text-dim);
          margin-top: 8px;
          font-size: 14px;
          line-height: 1.5;
        }

        .dashboard-login-buttons {
          display: grid;
          gap: 10px;
        }

        .provider-btn {
          display: inline-flex !important;
          align-items: center;
          justify-content: center;
          gap: 12px;
          width: 100%;
          background: var(--bg-card) !important;
          border: 1px solid var(--border-strong) !important;
          border-radius: var(--radius-md) !important;
          color: var(--text) !important;
          font-weight: 600 !important;
          padding: 13px 16px !important;
          box-shadow: 0 1px 2px rgba(10, 11, 13, 0.04);
        }

        .provider-btn:hover:not(:disabled) {
          background: #fff !important;
          border-color: var(--text) !important;
          transform: translateY(-1px);
          box-shadow: var(--shadow-hover);
        }

        .provider-btn :global(.provider-icon) {
          display: block;
          flex-shrink: 0;
          width: 20px;
          height: 20px;
        }

        .dashboard-divider {
          display: flex;
          align-items: center;
          gap: 14px;
          color: var(--text-muted);
          font-size: 12px;
          letter-spacing: 0.04em;
        }

        .dashboard-divider::before,
        .dashboard-divider::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
        }

        .dashboard-email-form {
          display: flex;
          gap: 10px;
        }

        .dashboard-email-form input,
        .dashboard-create-form input {
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          color: var(--text);
          flex: 1;
          font: inherit;
          min-width: 0;
          padding: 12px 14px;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }

        .dashboard-email-form input:focus,
        .dashboard-create-form input:focus {
          outline: none;
          border-color: var(--accent);
          box-shadow: var(--shadow-input);
        }

        .dashboard-email-submit {
          flex: 0 0 auto;
          white-space: nowrap;
        }

        .dashboard-grid {
          display: grid;
          gap: 16px;
          grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.35fr);
          animation: dashIn 0.45s var(--ease-out) both;
        }

        .dashboard-card {
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          box-shadow: var(--shadow-card);
          padding: 22px;
          backdrop-filter: blur(8px);
        }

        .dashboard-card h2 {
          color: var(--text);
          font-family: var(--font-display);
          font-size: 22px;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }

        .dashboard-card p {
          color: var(--text-dim);
        }

        .dashboard-create-form,
        .dashboard-card-header {
          display: flex;
          gap: 10px;
        }

        .dashboard-card-header {
          align-items: flex-start;
          justify-content: space-between;
        }

        .dashboard-page button {
          background: var(--accent);
          border: 0;
          border-radius: var(--radius-md);
          color: white;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          padding: 12px 16px;
          transition: transform 0.15s var(--ease-out), background 0.15s ease, box-shadow 0.15s ease,
            border-color 0.15s ease;
        }

        .dashboard-page button:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-1px);
        }

        .dashboard-page button:focus-visible {
          outline: 2px solid var(--accent);
          outline-offset: 2px;
        }

        .dashboard-page button:disabled {
          cursor: not-allowed;
          opacity: 0.6;
        }

        .dashboard-secondary {
          background: var(--bg-card) !important;
          border: 1px solid var(--border) !important;
          color: var(--text) !important;
        }

        .dashboard-secondary:hover:not(:disabled) {
          background: var(--bg) !important;
          border-color: var(--border-strong) !important;
        }

        .dashboard-account,
        .dashboard-billing,
        .dashboard-key-panel {
          align-content: start;
          display: grid;
          gap: 18px;
        }

        .dashboard-account-head {
          display: flex;
          align-items: flex-start;
          gap: 14px;
        }

        .dashboard-avatar {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          object-fit: cover;
          flex-shrink: 0;
          border: 1px solid var(--border);
        }

        .dashboard-avatar-fallback {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          background: var(--bg-ink);
          color: #fff;
          font-family: var(--font-display);
          font-weight: 700;
          font-size: 18px;
        }

        .dashboard-billing-actions {
          display: grid;
          gap: 10px;
        }

        .dashboard-stat {
          background: linear-gradient(145deg, var(--accent-light), rgba(255, 255, 255, 0.5));
          border: 1px solid rgba(255, 59, 0, 0.12);
          border-radius: var(--radius-lg);
          padding: 18px;
        }

        .dashboard-stat span {
          color: var(--accent);
          display: block;
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 700;
          letter-spacing: -0.05em;
          line-height: 1;
        }

        .dashboard-stat p {
          margin-top: 6px;
          font-size: 13px;
        }

        .dashboard-secret {
          align-items: center;
          background: var(--bg-ink);
          border-radius: var(--radius-lg);
          color: white;
          display: flex;
          gap: 14px;
          justify-content: space-between;
          padding: 16px;
        }

        .dashboard-secret code,
        .dashboard-example code,
        .dashboard-key-row code {
          font-family: var(--font-mono);
        }

        .dashboard-secret code {
          color: #d1fae5;
          display: block;
          font-size: 12px;
          margin-top: 8px;
          overflow-wrap: anywhere;
        }

        .dashboard-secret button {
          background: white;
          color: #111827;
          flex: 0 0 auto;
        }

        .dashboard-key-list {
          display: grid;
          gap: 10px;
        }

        .dashboard-key-row {
          align-items: center;
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          background: var(--bg);
          display: flex;
          justify-content: space-between;
          gap: 14px;
          padding: 14px;
        }

        .dashboard-key-row p {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          font-size: 13px;
          margin-top: 4px;
        }

        .dashboard-key-row button {
          background: transparent;
          border: 1px solid var(--border);
          color: var(--red);
          flex: 0 0 auto;
        }

        .dashboard-example {
          grid-column: 1 / -1;
        }

        .dashboard-example pre {
          background: var(--bg-ink);
          border-radius: var(--radius-lg);
          color: #e5e7eb;
          margin-top: 16px;
          overflow-x: auto;
          padding: 18px;
          font-size: 13px;
          line-height: 1.55;
        }

        .dashboard-note,
        .dashboard-empty,
        .dashboard-error {
          font-size: 14px;
        }

        .dashboard-error {
          color: var(--red) !important;
        }

        @keyframes dashIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .dashboard-login-layout,
          .dashboard-login,
          .dashboard-grid {
            animation: none;
          }

          .dashboard-page button:hover:not(:disabled),
          .provider-btn:hover:not(:disabled) {
            transform: none;
          }
        }

        @media (max-width: 860px) {
          .dashboard-login-layout {
            grid-template-columns: 1fr;
            min-height: 0;
            gap: 28px;
          }

          .dashboard-login-copy h1,
          .dashboard-hero h1 {
            max-width: none;
          }
        }

        @media (max-width: 760px) {
          .dashboard-page {
            padding: 20px 16px 48px;
          }

          .dashboard-topbar {
            margin-bottom: 28px;
          }

          .dashboard-grid,
          .dashboard-email-form,
          .dashboard-create-form {
            grid-template-columns: 1fr;
            flex-direction: column;
          }

          .dashboard-email-submit {
            width: 100%;
          }

          .dashboard-key-row,
          .dashboard-secret {
            align-items: stretch;
            flex-direction: column;
          }
        }
      `}</style>
    </main>
  );
}
