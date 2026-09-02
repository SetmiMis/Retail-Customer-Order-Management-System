'use client';

import { useLayoutEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsLeft, ChevronsRight, X } from 'lucide-react';
import Tooltip from '../ui/Tooltip';
import { sectionsForRole, type NavItem } from './nav';
import { useSession } from './SessionProvider';

const STORAGE_KEY = 'pfms-sidebar-collapsed';

function NavLink({ item, collapsed, active, onNavigate }: { item: NavItem; collapsed: boolean; active: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  const link = (
    <Link href={item.href} onClick={onNavigate} className="sidebar-link" data-active={active} aria-current={active ? 'page' : undefined}>
      <Icon size={18} strokeWidth={2.25} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  );
  return collapsed ? <Tooltip label={item.label}>{link}</Tooltip> : link;
}

function SidebarContent({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { role } = useSession();
  const sections = sectionsForRole(role);
  return (
    <nav className="sidebar-nav" aria-label="Main navigation">
      {sections.map((section) => (
        <div key={section.title} className="sidebar-section">
          {!collapsed && <div className="sidebar-section-title">{section.title}</div>}
          {section.items.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              collapsed={collapsed}
              active={pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      ))}
    </nav>
  );
}

export function DesktopSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className="sidebar" data-collapsed={collapsed} aria-label="Sidebar">
      <div className="sidebar-brand">
        <div className="logo" style={{ fontSize: 19 }}>{collapsed ? 'S' : <>SETMI <span className="in">INDIA</span></>}</div>
      </div>
      <SidebarContent collapsed={collapsed} />
      <button className="sidebar-collapse-btn" onClick={onToggle} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
        {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> <span>Collapse</span></>}
      </button>
    </aside>
  );
}

export function MobileSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <>
      <div className="drawer-bg" onClick={onClose} style={{ zIndex: 'var(--z-drawer)' as unknown as number }} />
      <aside className="sidebar sidebar-mobile" aria-label="Sidebar">
        <div className="sidebar-brand">
          <div className="logo" style={{ fontSize: 19 }}>SETMI <span className="in">INDIA</span></div>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close menu" style={{ padding: 6 }}>
            <X size={16} />
          </button>
        </div>
        <SidebarContent collapsed={false} onNavigate={onClose} />
      </aside>
    </>
  );
}

export function useSidebarState() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (window.localStorage.getItem(STORAGE_KEY) === '1') setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      window.localStorage.setItem(STORAGE_KEY, !c ? '1' : '0');
      return !c;
    });
  }
  return { collapsed, toggleCollapsed, mobileOpen, setMobileOpen };
}
