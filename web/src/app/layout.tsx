import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '@/components/providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'UniAgent - Decentralized AI Agent Marketplace',
  description: 'Decentralized marketplace for AI agents compliant with ERC-8004, A2A, and x402',
  keywords: ['AI', 'Agent', 'Blockchain', 'A2A', 'x402', 'ERC-8004', 'Marketplace'],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
