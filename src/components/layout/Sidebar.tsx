'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  label: string;
  href: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Update Sprint Data', href: '/sync', icon: '🔄' },
  { label: 'Burndown Chart', href: '/burndown', icon: '📊' },
  { label: 'Sprint Completion Rate', href: '/completion-rate', icon: '✅' },
  { label: 'Individual Completion Rate', href: '/individual-cr', icon: '👤' },
  // Future sections
  // { label: 'Team Capacity', href: '/capacity', icon: '👥' },
  // { label: 'Velocity Trends', href: '/velocity', icon: '📈' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 w-64 h-screen glass-card border-r border-white/10 text-white p-6 flex flex-col overflow-y-auto">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
          Performance Dashboard
        </h1>
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
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${
                isActive
                  ? 'bg-gradient-to-r from-purple-600/50 to-cyan-600/30 border border-purple-500/50 text-white font-semibold shadow-[0_0_15px_rgba(124,58,237,0.4)]'
                  : 'text-slate-300 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logo */}
      <img src="/devvy.png" alt="Logo" className="w-56 h-auto rounded-lg mb-4" />

      {/* Footer */}
      <div className="border-t border-white/10 pt-4">
        <p className="text-xs text-slate-300">© 2026 Product Development</p>
      </div>
    </aside>
  );
}
