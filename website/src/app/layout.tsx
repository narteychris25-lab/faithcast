import type { Metadata, Viewport } from 'next'
import { Instrument_Serif, Manrope } from 'next/font/google'
import { Providers } from '@/components/Providers'
import { site } from '@/lib/site'
import './globals.css'

const instrument = Instrument_Serif({
  variable: '--font-instrument',
  subsets: ['latin'],
  weight: '400',
  style: ['normal', 'italic']
})

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin']
})

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} | ${site.tagline}`,
    template: `%s | ${site.name}`
  },
  description: site.description,
  keywords: ['church presentation software', 'worship software', 'lyrics projection', 'Bible projection', 'EasyWorship alternative', 'church projector software', 'free church software'],
  openGraph: {
    type: 'website',
    siteName: site.name,
    title: `${site.name} | ${site.tagline}`,
    description: site.description,
    url: site.url
  },
  twitter: { card: 'summary_large_image', title: site.name, description: site.description }
}

export const viewport: Viewport = {
  themeColor: '#ffffff'
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`${instrument.variable} ${manrope.variable} antialiased`}>
      <body className="min-h-dvh">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
