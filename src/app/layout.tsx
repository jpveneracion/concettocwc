import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Concetto Window Blinds',
  description: 'Invoicing and order management for window blinds',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
