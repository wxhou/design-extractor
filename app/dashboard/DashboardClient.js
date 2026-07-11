'use client';

import { useEffect, useState } from 'react';
import { signIn, signOut } from 'next-auth/react';

const CURL_EXAMPLE = `curl -X POST https://url2design.com/api/v1/extract \\
  -H "Authorization: Bearer u2d_..." \\
  -H "Content-Type: application/json" \\
  -d '{"url":"https://stripe.com"}'`;

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
      setError(body?.error || 'Failed to load API keys');
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
      setError(body?.error || 'Failed to create API key');
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
    if (!window.confirm('Revoke this API key? Existing integrations using it will stop working.')) {
      return;
    }

    setWorking(true);
    setError(null);
    const response = await fetch(`/api/dashboard/keys?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    const body = await parseJson(response);

    if (!response.ok) {
      setError(body?.error || 'Failed to revoke API key');
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
      setError(body?.error || 'Failed to start checkout');
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
      setError(body?.error || 'Failed to open billing portal');
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
    <main className="dashboard-page">
      <section className="dashboard-shell">
        <div className="dashboard-hero">
          <a className="dashboard-home" href="/">Url2Design</a>
          <p className="dashboard-kicker">Paid API dashboard</p>
          <h1>Manage API keys for URL to design extraction.</h1>
          <p className="dashboard-subtitle">
            Create scoped API keys for your integrations. Plaintext keys are shown once on creation.
          </p>
        </div>

        {!user ? (
          <section className="dashboard-card dashboard-login">
            <div>
              <h2>Sign in to continue</h2>
              <p>Use GitHub, Google, or email magic link to access your API keys and credits.</p>
            </div>

            <div className="dashboard-login-buttons">
              <button type="button" onClick={() => signIn('github', { callbackUrl: '/dashboard' })}>
                Continue with GitHub
              </button>
              <button type="button" onClick={() => signIn('google', { callbackUrl: '/dashboard' })}>
                Continue with Google
              </button>
            </div>

            <form className="dashboard-email-form" onSubmit={signInWithEmail}>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
              <button type="submit">Email magic link</button>
            </form>
          </section>
        ) : (
          <div className="dashboard-grid">
            <section className="dashboard-card dashboard-account">
              <div>
                <p className="dashboard-label">Signed in</p>
                <h2>{user.name || user.email || 'API user'}</h2>
                {user.email && <p>{user.email}</p>}
              </div>
              <div className="dashboard-stat">
                <span>{remainingCredits ?? 'N/A'}</span>
                <p>remaining credits</p>
              </div>
              <button type="button" className="dashboard-secondary" onClick={() => signOut({ callbackUrl: '/dashboard' })}>
                Sign out
              </button>
            </section>

            <section className="dashboard-card dashboard-billing">
              <div>
                <p className="dashboard-label">Billing</p>
                <h2>Upgrade API credits</h2>
                <p>Starter includes 500 monthly credits. Pro includes 2,000 monthly credits.</p>
              </div>
              <div className="dashboard-billing-actions">
                <button type="button" onClick={() => startCheckout('starter')} disabled={billingWorking}>
                  Upgrade Starter
                </button>
                <button type="button" onClick={() => startCheckout('pro')} disabled={billingWorking}>
                  Upgrade Pro
                </button>
                {hasStripeCustomer && (
                  <button type="button" className="dashboard-secondary" onClick={manageBilling} disabled={billingWorking}>
                    Manage billing
                  </button>
                )}
              </div>
            </section>

            <section className="dashboard-card dashboard-key-panel">
              <div className="dashboard-card-header">
                <div>
                  <p className="dashboard-label">API keys</p>
                  <h2>Create and revoke keys</h2>
                </div>
                <button type="button" className="dashboard-secondary" onClick={loadKeys} disabled={loading}>
                  Refresh
                </button>
              </div>

              <form className="dashboard-create-form" onSubmit={createKey}>
                <input
                  value={keyName}
                  onChange={(event) => setKeyName(event.target.value)}
                  placeholder="Key name, e.g. Production"
                />
                <button type="submit" disabled={working}>Create key</button>
              </form>

              {plaintext && (
                <div className="dashboard-secret">
                  <div>
                    <strong>Copy this key now. It will not be shown again.</strong>
                    <code>{plaintext}</code>
                  </div>
                  <button type="button" onClick={copyPlaintext}>{copied ? 'Copied' : 'Copy'}</button>
                </div>
              )}

              {error && <p className="dashboard-error">{error}</p>}

              <div className="dashboard-key-list">
                {loading ? (
                  <p className="dashboard-empty">Loading keys...</p>
                ) : keys.length === 0 ? (
                  <p className="dashboard-empty">No API keys yet. Create one to call the API.</p>
                ) : keys.map((key) => (
                  <div className="dashboard-key-row" key={key.id}>
                    <div>
                      <strong>{key.name}</strong>
                      <p>
                        <code>{key.key_prefix}</code>
                        <span>Created {new Date(key.created_at).toLocaleDateString()}</span>
                        {key.last_used_at && <span>Last used {new Date(key.last_used_at).toLocaleDateString()}</span>}
                      </p>
                    </div>
                    <button type="button" onClick={() => revokeKey(key.id)} disabled={working}>
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="dashboard-card dashboard-example">
              <p className="dashboard-label">API example</p>
              <h2>Extract a design from a URL</h2>
              <pre><code>{CURL_EXAMPLE}</code></pre>
              <p className="dashboard-note">
                Test Stripe locally with: stripe listen --forward-to localhost:3000/api/stripe/webhook
              </p>
            </section>
          </div>
        )}
      </section>

      <style jsx>{`
        .dashboard-page {
          min-height: 100vh;
          padding: 48px 24px 72px;
          background:
            radial-gradient(circle at top left, rgba(230, 57, 70, 0.12), transparent 34rem),
            var(--bg);
        }

        .dashboard-shell {
          width: min(1080px, 100%);
          margin: 0 auto;
        }

        .dashboard-hero {
          margin-bottom: 28px;
        }

        .dashboard-home {
          color: var(--accent);
          display: inline-flex;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 24px;
          text-decoration: none;
        }

        .dashboard-kicker,
        .dashboard-label {
          color: var(--accent);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          margin-bottom: 8px;
          text-transform: uppercase;
        }

        .dashboard-hero h1 {
          color: var(--text);
          font-family: var(--font-display);
          font-size: clamp(36px, 7vw, 68px);
          letter-spacing: -0.045em;
          line-height: 1;
          max-width: 820px;
        }

        .dashboard-subtitle {
          color: var(--text-dim);
          font-size: 16px;
          margin-top: 18px;
          max-width: 560px;
        }

        .dashboard-grid {
          display: grid;
          gap: 18px;
          grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.4fr);
        }

        .dashboard-card {
          background: rgba(255, 255, 255, 0.86);
          border: 1px solid var(--border);
          border-radius: 22px;
          box-shadow: var(--shadow-card);
          padding: 24px;
        }

        .dashboard-card h2 {
          color: var(--text);
          font-family: var(--font-display);
          font-size: 24px;
          letter-spacing: -0.03em;
          line-height: 1.15;
        }

        .dashboard-card p {
          color: var(--text-dim);
        }

        .dashboard-login {
          display: grid;
          gap: 22px;
          max-width: 620px;
        }

        .dashboard-login-buttons,
        .dashboard-email-form,
        .dashboard-create-form,
        .dashboard-card-header {
          display: flex;
          gap: 10px;
        }

        .dashboard-card-header {
          align-items: flex-start;
          justify-content: space-between;
        }

        .dashboard-email-form input,
        .dashboard-create-form input {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          color: var(--text);
          flex: 1;
          font: inherit;
          min-width: 0;
          padding: 12px 14px;
        }

        .dashboard-page button {
          background: var(--accent);
          border: 0;
          border-radius: 12px;
          color: white;
          cursor: pointer;
          font: inherit;
          font-weight: 700;
          padding: 12px 16px;
          transition: transform 0.15s ease, background 0.15s ease;
        }

        .dashboard-page button:hover:not(:disabled) {
          background: var(--accent-hover);
          transform: translateY(-1px);
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

        .dashboard-account {
          align-content: start;
          display: grid;
          gap: 20px;
        }

        .dashboard-billing {
          align-content: start;
          display: grid;
          gap: 18px;
        }

        .dashboard-billing-actions {
          display: grid;
          gap: 10px;
        }

        .dashboard-stat {
          background: var(--accent-light);
          border-radius: 18px;
          padding: 18px;
        }

        .dashboard-stat span {
          color: var(--accent);
          display: block;
          font-family: var(--font-display);
          font-size: 42px;
          font-weight: 700;
          letter-spacing: -0.05em;
        }

        .dashboard-key-panel {
          display: grid;
          gap: 18px;
        }

        .dashboard-secret {
          align-items: center;
          background: #111827;
          border-radius: 16px;
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
          border-radius: 16px;
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
          background: #111827;
          border-radius: 18px;
          color: #e5e7eb;
          margin-top: 16px;
          overflow-x: auto;
          padding: 18px;
        }

        .dashboard-note,
        .dashboard-empty,
        .dashboard-error {
          font-size: 14px;
        }

        .dashboard-error {
          color: var(--red) !important;
        }

        @media (max-width: 760px) {
          .dashboard-page {
            padding: 28px 16px 48px;
          }

          .dashboard-grid,
          .dashboard-login-buttons,
          .dashboard-email-form,
          .dashboard-create-form {
            grid-template-columns: 1fr;
            flex-direction: column;
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
