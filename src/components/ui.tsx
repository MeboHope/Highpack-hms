import type { ReactNode } from 'react';
import { statusColor, titleCase } from '@/lib/constants';

export function Badge({ status, children }: { status?: string; children?: ReactNode }) {
  const label = children ?? (status ? titleCase(status) : '');
  return (
    <span className={`badge ${status ? statusColor(status) : 'bg-ink-100 text-ink-600'}`}>
      {label}
    </span>
  );
}

export function Card({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <div className={`card ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${className}`} onClick={onClick}>
      {children}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  trend,
  accent = 'brand',
  onClick,
}: {
  label: string;
  value: string | number;
  icon: ReactNode;
  trend?: string;
  accent?: 'brand' | 'accent' | 'blue' | 'red' | 'ink';
  onClick?: () => void;
}) {
  const accents = {
    brand: 'bg-brand-50 text-brand-600',
    accent: 'bg-accent-50 text-accent-600',
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    ink: 'bg-ink-100 text-ink-600',
  };
  return (
    <div
      className={`card p-5 relative overflow-hidden ${onClick ? 'dashboard-stat-clickable cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg hover:border-brand-200 focus-within:ring-2 focus-within:ring-brand-500/20' : ''}`}
      onClick={onClick}
      onKeyDown={(e) => { if (onClick && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onClick(); } }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-ink-500">{label}</span>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${accents[accent]}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-ink-900">{value}</p>
      {trend && <p className="text-xs text-ink-400 mt-1">{trend}</p>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-ink-100 flex items-center justify-center text-ink-400 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-ink-800 mb-1">{title}</h3>
      {description && <p className="text-sm text-ink-500 max-w-sm mb-4">{description}</p>}
      {action}
    </div>
  );
}

export function Spinner({ className = '' }: { className?: string }) {
  return (
    <div className={`inline-block animate-spin rounded-full border-2 border-ink-200 border-t-brand-500 ${className}`} style={{ width: '1em', height: '1em' }} />
  );
}

export function LoadingPage() {
  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Spinner className="w-8 h-8 text-brand-500" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="card overflow-hidden">
      <div className="skeleton h-48 w-full" />
      <div className="p-4 space-y-3">
        <div className="skeleton h-4 w-3/4" />
        <div className="skeleton h-3 w-1/2" />
        <div className="flex gap-2">
          <div className="skeleton h-6 w-16" />
          <div className="skeleton h-6 w-16" />
        </div>
      </div>
    </div>
  );
}


export function Pagination({ page, totalPages, onPageChange, totalItems, pageSize = 20 }: { page: number; totalPages: number; onPageChange: (page: number) => void; totalItems?: number; pageSize?: number }) {
  const safeTotalPages = Math.max(1, totalPages);
  const startItem = totalItems && totalItems > 0 ? ((page - 1) * pageSize) + 1 : 0;
  const endItem = totalItems && totalItems > 0 ? Math.min(page * pageSize, totalItems) : 0;
  const pages: Array<number | 'ellipsis'> = [];
  const add = (p: number) => { if (!pages.includes(p)) pages.push(p); };
  add(1);
  const start = Math.max(2, page - 2);
  const end = Math.min(safeTotalPages - 1, page + 2);
  if (start > 2) pages.push('ellipsis');
  for (let p = start; p <= end; p++) add(p);
  if (end < safeTotalPages - 1) pages.push('ellipsis');
  if (safeTotalPages > 1) add(safeTotalPages);
  return <div className="flex flex-col gap-3 border-t border-ink-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
    <p className="text-xs text-ink-500">{totalItems !== undefined && totalItems > 0 ? `Showing ${startItem}–${endItem} of ${totalItems}` : `Page ${page} of ${safeTotalPages}`}</p>
    <div className="flex items-center gap-1">
      <button type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
      {pages.map((p, i) => p === 'ellipsis' ? <span key={`e-${i}`} className="px-2 text-ink-400">…</span> : <button type="button" key={p} onClick={() => onPageChange(p)} className={`min-w-9 rounded-lg border px-3 py-2 text-xs font-semibold ${p === page ? 'border-brand-700 bg-brand-700 text-white' : 'border-ink-200 text-ink-600 hover:bg-brand-50'}`}>{p}</button>)}
      <button type="button" disabled={page === safeTotalPages} onClick={() => onPageChange(page + 1)} className="rounded-lg border border-ink-200 px-3 py-2 text-xs font-semibold text-ink-600 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
    </div>
  </div>;
}
