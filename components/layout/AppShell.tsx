'use client';

import { DesktopSidebar, MobileSidebar, useSidebarState } from './Sidebar';
import Header from './Header';
import { SessionProvider } from './SessionProvider';
import type { StaffSession } from '../../lib/auth/session';

export default function AppShell({ user, children }: { user: StaffSession; children: React.ReactNode }) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebarState();

  return (
    <SessionProvider user={user}>
      <div className="app-shell">
        <DesktopSidebar collapsed={collapsed} onToggle={toggleCollapsed} />
        <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />
        <div className="app-main">
          <Header onMobileMenu={() => setMobileOpen(true)} />
          <div className="app-content">{children}</div>
        </div>
      </div>
    </SessionProvider>
  );
}
