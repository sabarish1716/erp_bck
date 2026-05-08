import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'HR Intelligence Dashboard',
  description: 'HR control center wired to ERP backend endpoints',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
