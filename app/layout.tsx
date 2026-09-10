import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sign in | SubTrack',
  description: 'Sign in to keep every subscription in one calm, organized place.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
