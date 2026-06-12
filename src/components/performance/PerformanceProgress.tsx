import { cn } from '@/lib/utils';

interface PerformanceProgressProps {
  value: number;
  className?: string;
}

/** Shared progress component used across performance pages */
export function PerformanceProgress({ value, className }: PerformanceProgressProps) {
  const color = value >= 100 ? 'var(--success-500)' : value >= 50 ? 'var(--primary-600)' : 'var(--warning-500)';

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <div className="flex-1 h-1.5 bg-[var(--glass-10)] rounded-full overflow-hidden border border-white/5">
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-[11px] font-black w-8 text-right uppercase tracking-tighter"
        style={{ color }}
      >
        {value}%
      </span>
    </div>
  );
}
