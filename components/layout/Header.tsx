'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Menu, LogOut } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import Dropdown from '../ui/Dropdown';
import NotifBell from './NotifBell';
import GlobalSearch from './GlobalSearch';
import { ROUTE_LABELS } from './nav';
import { useSession } from './SessionProvider';

const ROLE_LABEL: Record<string, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  SALES: 'Sales / Order Entry',
  WAREHOUSE: 'Warehouse',
  DISPATCH: 'Dispatch',
};

export default function Header({ onMobileMenu }: { onMobileMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useSession();
  const label =
    ROUTE_LABELS[pathname] ||
    Object.entries(ROUTE_LABELS).find(([h]) => h !== '/staff/dashboard' && pathname.startsWith(h))?.[1] ||
    'Order Ops';
  const initials = user.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'U';

  async function logout() {
    await fetch('/api/auth/staff/logout', { method: 'POST' });
    router.push('/staff/login');
    router.refresh();
  }

  return (
    <header className="app-header">
      <div className="app-header-left">
        <button className="icon-btn mobile-only" onClick={onMobileMenu} aria-label="Open menu">
          <Menu size={18} />
        </button>
        <div className="breadcrumbs">
          <span>Order Ops</span>
          <span aria-hidden>/</span>
          <span className="current">{label}</span>
        </div>
      </div>

      <div className="app-header-right">
        <GlobalSearch />
        <NotifBell endpoint="/api/staff/notifications" hrefBase="/staff/orders" />
        <ThemeToggle />
        <Dropdown
          trigger={
            <button className="icon-btn" aria-label="Account menu" style={{ borderRadius: '50%' }}>
              <span style={{ fontSize: 11, fontWeight: 800 }}>{initials}</span>
            </button>
          }
          items={[
            { label: `${user.name} · ${ROLE_LABEL[user.role] ?? user.role}`, onClick: () => {} },
            { label: 'Log out', icon: <LogOut size={14} />, onClick: logout, danger: true },
          ]}
        />
      </div>
    </header>
  );
}
