'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export default function Navbar() {
  const { data: session } = useSession();

  return (
    <nav className="border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="text-xl font-semibold">
              Barong Inventory
            </Link>
          </div>
          {session ? (
            <div className="flex items-center space-x-4">
              <Link href="/" className="text-sm font-medium hover:underline">
                Dashboard
              </Link>
              <Link href="/inventory" className="text-sm font-medium hover:underline">
                Inventory
              </Link>
              <Link href="/sales" className="text-sm font-medium hover:underline">
                Sales
              </Link>
              <Link href="/sales/summary" className="text-sm font-medium hover:underline">
                Summary
              </Link>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-muted-foreground">{session.user?.name}</span>
                <Button variant="ghost" size="sm" onClick={() => signOut()}>
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <Link href="/login">
                <Button variant="ghost" size="sm">Sign In</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}

