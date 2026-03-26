'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '\u25A3' },
  { href: '/tamir', label: 'Tamir', icon: '\u25D0' },
  { href: '/deliverables', label: 'Deliverables', icon: '\u25CE' },
  { href: '/org-context', label: 'Org Context', icon: '\u25C6' },
  { href: '/vault', label: 'Vault', icon: '\u2B21' },
  { href: '/settings', label: 'Settings', icon: '\u2699' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Myelin</div>
      <div className="sidebar-version">v10 — The Cortex</div>
      <nav>
        {NAV_ITEMS.map((link) => {
          const isActive =
            link.href === '/'
              ? pathname === '/'
              : pathname.startsWith(link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={isActive ? 'nav-link active' : 'nav-link'}
            >
              <span className="nav-icon">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
