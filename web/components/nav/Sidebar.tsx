'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { LayoutDashboard, ListTodo, GitBranch, FileText, LogOut } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/tracker', label: 'Tracker', icon: ListTodo },
  { href: '/pipeline', label: 'Pipeline', icon: GitBranch },
  { href: '/reports', label: 'Reports', icon: FileText },
];

export function Sidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();

  return (
    <aside className="flex h-screen w-52 flex-col border-r bg-card px-3 py-4">
      <div className="mb-6 px-2">
        <span className="text-sm font-semibold tracking-tight">career-ops</span>
      </div>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-2.5 rounded-md px-2 py-2 text-sm transition-colors',
              pathname === href
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
            )}
          >
            <Icon size={16} />
            {label}
          </Link>
        ))}
      </nav>

      {session && (
        <div className="flex items-center justify-between gap-2 border-t pt-3">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium">{session.user?.name}</p>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth/signin' })}
            className="text-muted-foreground hover:text-foreground"
            title="Sign out"
          >
            <LogOut size={14} />
          </button>
        </div>
      )}
    </aside>
  );
}
