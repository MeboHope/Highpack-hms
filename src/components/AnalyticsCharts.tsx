import type { CSSProperties, ReactNode } from 'react';

export type ChartPoint = { label: string; value: number; secondary?: number };

const maxValue = (points: ChartPoint[]) =>
  Math.max(1, ...points.flatMap((p) => [p.value, p.secondary ?? 0]));

export function TrendChart({
  points,
  valueLabel = 'Amount',
  prefix = 'KES ',
}: {
  points: ChartPoint[];
  valueLabel?: string;
  prefix?: string;
}) {
  const max = maxValue(points);
  const width = 720;
  const height = 240;
  const padX = 34;
  const padY = 28;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const coords = points.map((p, i) => ({
    x: padX + (points.length <= 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
    y: padY + innerH - (p.value / max) * innerH,
    p,
  }));
  const line = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const area = `${padX},${padY + innerH} ${line} ${padX + innerW},${padY + innerH}`;

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <div>
          <p className="chart-kicker">{valueLabel}</p>
          <p className="chart-caption">Movement over time</p>
        </div>
        <span className="chart-total">
          {prefix}{Math.round(points[points.length - 1]?.value || 0).toLocaleString()}
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl bg-ink-50/60 p-2">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label={`${valueLabel} trend chart`}>
          {[0, 0.25, 0.5, 0.75, 1].map((r) => (
            <line key={r} x1={padX} x2={width - padX} y1={padY + innerH * r} y2={padY + innerH * r} stroke="currentColor" className="text-ink-200" />
          ))}
          <polygon points={area} className="chart-area-fill" />
          <polyline points={line} fill="none" stroke="currentColor" className="chart-trend-line text-brand-700" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {coords.map((c, i) => (
            <g key={c.p.label}>
              <circle cx={c.x} cy={c.y} r="5" className="chart-point fill-white stroke-brand-700" strokeWidth="3" style={{ animationDelay: `${i * 90 + 220}ms` }} />
              <text x={c.x} y={height - 7} textAnchor="middle" className="fill-ink-500 text-[11px]">{c.p.label}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function ComparisonBars({
  points,
  primaryLabel = 'Collected',
  secondaryLabel = 'Expected',
  prefix = 'KES ',
}: {
  points: ChartPoint[];
  primaryLabel?: string;
  secondaryLabel?: string;
  prefix?: string;
}) {
  const max = maxValue(points);

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <div>
          <p className="chart-kicker">Portfolio performance</p>
          <p className="chart-caption">{primaryLabel} versus {secondaryLabel.toLowerCase()}</p>
        </div>
        <div className="flex gap-3 text-[11px] font-semibold text-ink-500">
          <span><i className="chart-dot chart-dot-primary" />{primaryLabel}</span>
          <span><i className="chart-dot chart-dot-secondary" />{secondaryLabel}</span>
        </div>
      </div>
      <div className="mt-5 space-y-4">
        {points.map((p, i) => (
          <div key={p.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-semibold text-ink-700">{p.label}</span>
              <span className="shrink-0 text-ink-400">
                {prefix}{Math.round(p.value).toLocaleString()} / {prefix}{Math.round(p.secondary || 0).toLocaleString()}
              </span>
            </div>
            <div className="relative h-7 overflow-hidden rounded-lg bg-ink-100">
              <div className="chart-bar-secondary absolute inset-y-0 left-0 rounded-lg bg-ink-300" style={{ width: `${Math.max(3, ((p.secondary || 0) / max) * 100)}%`, animationDelay: `${i * 90}ms` }} />
              <div className="chart-bar-primary absolute inset-y-1 left-0 rounded-md bg-brand-700" style={{ width: `${Math.max(3, (p.value / max) * 100)}%`, animationDelay: `${i * 90 + 100}ms` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
  centerLabel,
  centerValue,
}: {
  segments: Array<{ label: string; value: number }>;
  centerLabel: string;
  centerValue: string;
}) {
  const total = Math.max(1, segments.reduce((sum, item) => sum + item.value, 0));
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;

  const donutSegments = segments.map((segment, index) => {
    const length = (segment.value / total) * circumference;
    const offset = -cursor;
    cursor += length;
    const tone = index % 3 === 0
      ? 'text-brand-700'
      : index % 3 === 1
        ? 'text-accent-500'
        : 'text-blue-500';

    const style: CSSProperties = {
      '--donut-from': `${offset + circumference}px`,
      '--donut-to': `${offset}px`,
      animationDelay: `${index * 110}ms`,
    } as CSSProperties;

    return { segment, index, length, offset, tone, style };
  });

  return (
    <div className="chart-panel">
      <div className="chart-panel-head">
        <div>
          <p className="chart-kicker">Portfolio mix</p>
          <p className="chart-caption">Current operating distribution</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-6">
        <div className="relative h-40 w-40 shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
            <circle cx="60" cy="60" r={radius} fill="none" stroke="currentColor" className="text-ink-100" strokeWidth="14" />
            {donutSegments.map(({ segment, index, length, offset, tone, style }) => (
              <circle
                key={`${segment.label}-${index}`}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke="currentColor"
                className={`${tone} chart-donut-segment`}
                strokeWidth="14"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={offset}
                style={style}
              />
            ))}
          </svg>
          <div className="absolute inset-0 grid place-items-center text-center">
            <div>
              <p className="text-2xl font-bold text-ink-900">{centerValue}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">{centerLabel}</p>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          {segments.map((segment, index) => {
            const dotClass = index % 3 === 0
              ? 'chart-dot-primary'
              : index % 3 === 1
                ? 'chart-dot-secondary'
                : 'chart-dot-blue';
            return (
              <div key={`${segment.label}-legend`} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2">
                  <i className={`chart-dot ${dotClass}`} />
                  <span className="truncate text-ink-600">{segment.label}</span>
                </span>
                <strong className="text-ink-900">{segment.value}</strong>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function InsightCard({
  icon,
  title,
  value,
  detail,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="insight-card">
      <div className="insight-icon">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">{title}</p>
        <p className="mt-1 truncate text-lg font-bold text-ink-900">{value}</p>
        <p className="mt-1 text-xs text-ink-500">{detail}</p>
      </div>
    </div>
  );
}
