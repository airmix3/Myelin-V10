'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: '\u25A3' },
  { href: '/escalations', label: 'Escalations', icon: '\u26A0' },
  { href: '/tamir', label: 'Tamir', icon: '\u25D0' },
  { href: '/deliverables', label: 'Deliverables', icon: '\u25CE' },
  { href: '/assets', label: 'Assets', icon: '\u25A8' },
  { href: '/org-context', label: 'Org Context', icon: '\u25C6' },
  { href: '/org-graph', label: 'Org Graph', icon: '\u2B2A' },
  { href: '/vault', label: 'Vault', icon: '\u2B21' },
  { href: '/search', label: 'Search', icon: '\u2315' },
  { href: '/settings', label: 'Settings', icon: '\u2699' },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">Cortex</div>
      <div className="sidebar-version">AI Operating System</div>
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
