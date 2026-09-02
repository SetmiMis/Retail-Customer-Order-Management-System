'use client';

import { useEffect, useState } from 'react';
import { DesktopSidebar, MobileSidebar, useSidebarState } from './Sidebar';
import Header from './Header';
import CommandPalette from './CommandPalette';
import { SessionProvider } from './SessionProvider';
import type { StaffSession } from '../../lib/auth/session';

export default function AppShell({ user, children }: { user: StaffSession; children: React.ReactNode }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();
  const [commandOpen, setCommandOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandOpen((o) => !o);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  return (
    <SessionProvider user={user}>
      <div className="app-shell">
        <DesktopSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="app-main">
          <Header onMobileMenu={() => setMobileOpen(true)} onOpenCommand={() => setCommandOpen(true)} />
          <div className="app-content">{children}</div>
        </div>
        <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
      </div>
    </SessionProvider>
  );
}
