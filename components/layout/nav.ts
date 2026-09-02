import {
  LayoutDashboard, AlertTriangle, ClipboardList, PlusCircle, BadgeCheck,
  Scale, GitBranch, PackageSearch, ClipboardCheck, Truck, Boxes, Users2,
  BarChart3, ScrollText, UserCog,
} from 'lucide-react';
import type { OmsRole } from '../../lib/oms/constants';

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  roles: OmsRole[];
  keywords?: string;
}
export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL: OmsRole[] = ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE', 'DISPATCH'];

export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Overview',
    items: [
      { href: '/staff/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ALL },
      { href: '/staff/attention', label: 'Needs Attention', icon: AlertTriangle, roles: ['ADMIN', 'MANAGER', 'SALES', 'WAREHOUSE', 'DISPATCH'], keywords: 'exceptions alerts waiting' },
    ],
  },
  {
    title: 'Orders',
    items: [
      { href: '/staff/orders', label: 'All Orders', icon: ClipboardList, roles: ALL },
      { href: '/staff/orders/new', label: 'Create Order', icon: PlusCircle, roles: ['ADMIN', 'MANAGER', 'SALES'], keywords: 'phone whatsapp email intake on behalf' },
      { href: '/staff/confirmations', label: 'Confirmation Queue', icon: BadgeCheck, roles: ['ADMIN', 'MANAGER', 'SALES'], keywords: 'customer confirm rate' },
    ],
  },
  {
    title: 'Fulfilment',
    items: [
      { href: '/staff/quantity-check', label: 'Quantity Check', icon: Scale, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
      { href: '/staff/requirements', label: 'Requirements', icon: GitBranch, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'], keywords: 'shortage pfms purchase' },
      { href: '/staff/packing', label: 'Packing Queue', icon: PackageSearch, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
      { href: '/staff/verification', label: 'Final Verification', icon: ClipboardCheck, roles: ['ADMIN', 'MANAGER', 'WAREHOUSE'] },
      { href: '/staff/dispatch', label: 'Dispatch Queue', icon: Truck, roles: ['ADMIN', 'MANAGER', 'DISPATCH'] },
    ],
  },
  {
    title: 'Catalogue',
    items: [
      { href: '/staff/products', label: 'Products', icon: Boxes, roles: ['ADMIN', 'MANAGER'] },
      { href: '/staff/customers', label: 'Customers', icon: Users2, roles: ['ADMIN', 'MANAGER', 'SALES'] },
    ],
  },
  {
    title: 'Insights & Admin',
    items: [
      { href: '/staff/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN', 'MANAGER'] },
      { href: '/staff/users', label: 'Users', icon: UserCog, roles: ['ADMIN'] },
      { href: '/staff/audit', label: 'Audit Log', icon: ScrollText, roles: ['ADMIN', 'MANAGER'] },
    ],
  },
];

export function sectionsForRole(role: OmsRole | undefined): NavSection[] {
  if (!role) return [];
  return NAV_SECTIONS.map((s) => ({ ...s, items: s.items.filter((it) => it.roles.includes(role)) })).filter((s) => s.items.length);
}

export const ROUTE_LABELS: Record<string, string> = Object.fromEntries(
  NAV_SECTIONS.flatMap((s) => s.items).map((it) => [it.href, it.label]),
);
