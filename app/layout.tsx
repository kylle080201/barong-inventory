import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/providers/session-provider';
import { Toaster } from '@/components/ui/sonner';

export const metadata: Metadata = {
  title: 'Barong Inventory Management',
  description: 'Inventory and sales management system for barong products',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}

