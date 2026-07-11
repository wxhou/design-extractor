import './globals.css'
import { Agentation } from 'agentation'

export const metadata = {
  title: 'Url2Design',
  description: 'Turn any URL into design tokens — instant extract, API for agents',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <a
          href="/dashboard"
          style={{
            position: 'fixed',
            right: 16,
            bottom: 16,
            zIndex: 200,
            border: '1px solid var(--border)',
            borderRadius: 999,
            background: 'var(--bg-card)',
            color: 'var(--text)',
            padding: '8px 12px',
            fontSize: 12,
            fontWeight: 700,
            textDecoration: 'none',
            boxShadow: 'var(--shadow-card)',
          }}
        >
          Dashboard
        </a>
        {children}
        {process.env.NODE_ENV === 'development' && <Agentation endpoint="http://localhost:4747" />}
      </body>
    </html>
  )
}
