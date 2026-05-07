import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'PawChef · AI宠物食谱',
  description: 'AI驱动的宠物营养食谱平台，严格遵循ASPCA·AAFCO·FEDIAF国际标准',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  )
}
