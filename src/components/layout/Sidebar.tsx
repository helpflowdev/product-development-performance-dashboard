'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Burndown Chart', href: '/burndown', icon: '📊' },
  { label: 'Sprint Completion Rate', href: '/completion-rate', icon: '✅' },
  // Future sections
  // { label: 'Team Capacity', href: '/capacity', icon: '👥' },
  // { label: 'Velocity Trends', href: '/velocity', icon: '📈' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-slate-800 text-white min-h-screen p-6 flex flex-col">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-2xl font-bold tracking-tight">Performance Dashboard</h1>
        <p className="text-sm text-slate-300 mt-1">Product Development Metrics</p>
      </div>

      {/* Navigation */}
      <nav className="space-y-3 flex-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-slate-700 pt-4 text-xs text-slate-400">
        <p>© 2026 Product Development</p>
      </div>
    </aside>
  );
}
