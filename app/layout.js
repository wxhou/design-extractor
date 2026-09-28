import './globals.css'
import { IBM_Plex_Sans, JetBrains_Mono, Syne } from 'next/font/google'
import { Agentation } from "agentation"

const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-syne',
})

const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
})

export const metadata = {
  title: 'Url2Design | URL → Design System',
  description: 'Paste any URL. Extract DESIGN.md, Tailwind, CSS variables, and DTCG tokens. Free on the web, paid API for agents.',
  icons: {
    icon: '/favicon.svg',
  },
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${syne.variable} ${plexSans.variable} ${jetbrainsMono.variable}`}>
      <body>
        {children}
        {process.env.NODE_ENV === "development" && <Agentation />}
      </body>
    </html>
  )
}