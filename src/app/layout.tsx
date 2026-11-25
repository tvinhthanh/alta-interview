import type { Metadata, Viewport } from 'next'
import { Barlow_Condensed, Be_Vietnam_Pro } from 'next/font/google'
import './globals.css'

const barlow = Barlow_Condensed({
  subsets: ['latin', 'vietnamese'],
  weight: ['600', '800'],
  variable: '--font-barlow',
  display: 'swap',
})

const beVietnam = Be_Vietnam_Pro({
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-be-vietnam',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Bảng xếp hạng tháng',
  description: 'Bảng xếp hạng theo tháng, cập nhật trực tiếp.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#ebe8e1',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${barlow.variable} ${beVietnam.variable}`}>
      <body>{children}</body>
    </html>
  )
}
