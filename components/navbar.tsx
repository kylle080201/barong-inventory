'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: '/', label: 'Dashboard' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/sales', label: 'Sales' },
  { href: '/sales/summary', label: 'Summary' },
];

export default function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <nav className="border-b bg-background">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between gap-3">
          <Link
            href="/"
            className="shrink-0 whitespace-nowrap text-lg font-semibold sm:text-xl"
            onClick={() => setOpen(false)}
          >
            Barong Inventory
          </Link>

          {session ? (
            <>
              <div className="hidden items-center gap-4 lg:flex">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="text-sm font-medium hover:underline"
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="flex items-center gap-2">
                  <span className="max-w-[10rem] truncate text-sm text-muted-foreground">
                    {session.user?.name}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => signOut()}>
                    Sign Out
                  </Button>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-expanded={open}
                aria-controls="mobile-nav"
                aria-label={open ? 'Close menu' : 'Open menu'}
                onClick={() => setOpen((value) => !value)}
              >
                {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button variant="ghost" size="sm">
                Sign In
              </Button>
            </Link>
          )}
        </div>

        {session && open && (
          <div id="mobile-nav" className="border-t py-2 lg:hidden">
            <div className="flex flex-col">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-md px-3 py-3 text-sm font-medium hover:bg-accent"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </div>
            <div className="mt-1 flex items-center justify-between gap-3 border-t px-3 py-2">
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                {session.user?.name}
              </span>
              <Button variant="ghost" size="sm" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
