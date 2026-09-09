import type { ReactNode } from 'react';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui';

export function PortalPageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <Card className="mb-6 overflow-hidden border-brand-100 bg-gradient-to-br from-white via-white to-brand-50/60">
      <div className="relative p-5 sm:p-6 lg:p-7">
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full bg-accent-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-brand-600">
              <span>{eyebrow}</span><span className="text-ink-300">•</span><span className="inline-flex items-center gap-1 text-ink-400"><ShieldCheck className="h-3 w-3" /> Secure workspace</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-ink-950 sm:text-3xl">{title}</h2>
            <p className="mt-2 text-sm leading-6 text-ink-500">{description}</p>
          </div>
          {action && <div className="relative flex shrink-0 items-center gap-2">{action}<ArrowRight className="hidden h-4 w-4 text-ink-300 lg:block" /></div>}
        </div>
      </div>
    </Card>
  );
}
