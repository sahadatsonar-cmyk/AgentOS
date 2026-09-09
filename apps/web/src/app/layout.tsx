import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'AgentOS — Autonomous AI Agent Platform',
  description:
    'Give a natural-language goal. AgentOS plans, runs tools, verifies, recovers, and asks for approval when needed.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} bg-mesh min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
