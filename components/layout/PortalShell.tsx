'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutGrid, Search, ClipboardList, User, LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Dropdown from '../ui/Dropdown';
import type { CustomerSession } from '../../lib/auth/session';

const LINKS = [
  { href: '/portal/dashboard', label: 'Home', icon: LayoutGrid },
  { href: '/portal/catalog', label: 'Catalogue', icon: Search },
  { href: '/portal/orders', label: 'My Orders', icon: ClipboardList },
  { href: '/portal/profile', label: 'Profile', icon: User },
];

export default function PortalShell({ customer, children }: { customer: CustomerSession; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const active = (href: string) => pathname === href || pathname.startsWith(href + '/');
  const initials = (customer.companyName || customer.contactName || 'C').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  async function logout() {
    await fetch('/api/auth/customer/logout', { method: 'POST' });
    router.push('/portal/login');
    router.refresh();
  }

  return (
    <div className="portal-shell">
      <header className="portal-topbar">
        <Link href="/portal/dashboard" className="logo" style={{ fontSize: 18, textDecoration: 'none' }}>
          SETMI <span className="in">INDIA</span>
        </Link>
        <nav className="portal-navlinks">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} data-active={active(l.href)}>{l.label}</Link>
          ))}
        </nav>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ThemeToggle />
          <Dropdown
            trigger={
              <button className="icon-btn" aria-label="Account" style={{ borderRadius: '50%' }}>
                <span style={{ fontSize: 11, fontWeight: 800 }}>{initials}</span>
              </button>
            }
            items={[
              { label: customer.companyName || customer.contactName, onClick: () => {} },
              { label: 'Log out', icon: <LogOut size={14} />, onClick: logout, danger: true },
            ]}
          />
        </div>
      </header>

      <main className="portal-main">{children}</main>

      <nav className="portal-tabbar">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} data-active={active(l.href)}>
            <l.icon size={18} />
            {l.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
