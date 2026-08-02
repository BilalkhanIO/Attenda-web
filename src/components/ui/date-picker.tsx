'use client';
import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { formatDate, LOCAL_TZ } from '@/lib/i18n';
import { ChevronLeft, ChevronRight, Calendar, Clock, AlertTriangle } from 'lucide-react';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_NAMES = Array.from({ length: 12 }, (_, i) =>
  formatDate(new Date(2000, i, 1), { month: 'long', timeZone: LOCAL_TZ }),
);
const DAY_LABELS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface CalCell {
  date: Date;
  day: number;
  inMonth: boolean;
  isToday: boolean;
}

function buildCells(year: number, month: number): CalCell[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstOfMonth = new Date(year, month, 1);
  const firstIdx = (firstOfMonth.getDay() + 6) % 7; // Mon = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthTotal = new Date(year, month, 0).getDate();

  const cells: CalCell[] = [];

  for (let i = firstIdx - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthTotal - i);
    cells.push({ date: d, day: d.getDate(), inMonth: false, isToday: d.getTime() === today.getTime() });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(year, month, i);
    cells.push({ date: d, day: i, inMonth: true, isToday: d.getTime() === today.getTime() });
  }
  const rem = cells.length % 7;
  if (rem > 0) {
    for (let i = 1; i <= 7 - rem; i++) {
      const d = new Date(year, month + 1, i);
      cells.push({ date: d, day: i, inMonth: false, isToday: d.getTime() === today.getTime() });
    }
  }
  return cells;
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isSameDay(d: Date, str: string): boolean {
  if (!str) return false;
  const [y, m, day] = str.split('-').map(Number);
  return d.getFullYear() === y && d.getMonth() + 1 === m && d.getDate() === day;
}

function formatDateLabel(str: string): string {
  if (!str) return '';
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  // Local calendar date — format in the browser timezone (LOCAL_TZ) so the day never shifts.
  return formatDate(date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: LOCAL_TZ });
}

function useOutsideClick(ref: React.RefObject<HTMLDivElement | null>, cb: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [active, cb, ref]);
}

// ─── Calendar Grid (shared) ───────────────────────────────────────────────────

interface CalendarGridProps {
  year: number;
  month: number;
  selectedDate?: string;
  minDate?: string;
  maxDate?: string;
  onSelect: (str: string) => void;
  onPrev: () => void;
  onNext: () => void;
}

function CalendarGrid({ year, month, selectedDate, minDate, maxDate, onSelect, onPrev, onNext }: CalendarGridProps) {
  const cells = buildCells(year, month);
  return (
    <div>
      {/* Month nav */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--glass-border)]">
        <button
          type="button"
          onClick={onPrev}
          aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-10)] transition-all active:scale-90"
        >
          <ChevronLeft size={16} />
        </button>
        <p className="text-[13px] font-black text-white uppercase tracking-widest">
          {MONTH_NAMES[month]} {year}
        </p>
        <button
          type="button"
          onClick={onNext}
          aria-label="Next month"
          className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:text-white hover:bg-[var(--glass-10)] transition-all active:scale-90"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 px-3 pt-3 pb-1">
        {DAY_LABELS.map(d => (
          <div key={d} className="text-center text-[9px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div className="grid grid-cols-7 gap-px px-3 pb-3">
        {cells.map((cell, i) => {
          const str = toDateStr(cell.date);
          const selected = isSameDay(cell.date, selectedDate ?? '');
          const disabled = (!!minDate && str < minDate) || (!!maxDate && str > maxDate);
          return (
            <button
              key={i}
              type="button"
              onClick={() => !disabled && onSelect(str)}
              disabled={disabled}
              className={cn(
                'h-8 w-full rounded-lg text-[11px] font-bold transition-all',
                selected && 'bg-[var(--primary-600)] text-white font-black shadow-lg shadow-[var(--primary-600)]/30',
                !selected && cell.isToday && 'border border-[var(--primary-600)]/70 text-[var(--primary-600)]',
                !selected && !cell.isToday && cell.inMonth && 'text-white hover:bg-[var(--glass-10)]',
                !selected && !cell.isToday && !cell.inMonth && 'text-[var(--on-glass-dim)]/30 hover:bg-[var(--glass-05)]',
                disabled && 'opacity-25 cursor-not-allowed pointer-events-none',
              )}
            >
              {cell.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Time Columns (shared) ────────────────────────────────────────────────────

interface TimeColumnsProps {
  hour: string;
  minute: string;
  minuteStep: number;
  onHour: (h: string) => void;
  onMinute: (m: string) => void;
}

function TimeColumns({ hour, minute, minuteStep, onHour, onMinute }: TimeColumnsProps) {
  const hours = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
  const minutes = Array.from({ length: Math.ceil(60 / minuteStep) }, (_, i) =>
    String(i * minuteStep).padStart(2, '0')
  );
  const hourRef = useRef<HTMLDivElement>(null);
  const minRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scroll = (el: HTMLDivElement | null, val: string) => {
      if (!el || !val) return;
      const item = el.querySelector<HTMLElement>(`[data-v="${val}"]`);
      if (item) item.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    const t = setTimeout(() => {
      scroll(hourRef.current, hour);
      scroll(minRef.current, minute);
    }, 60);
    return () => clearTimeout(t);
  }, [hour, minute]);

  const colCls = 'flex-1 max-h-44 overflow-y-auto custom-scrollbar';
  const itemCls = (active: boolean) =>
    cn(
      'w-full py-2 text-[13px] font-black text-center transition-all',
      active
        ? 'bg-[var(--primary-600)] text-white'
        : 'text-[var(--on-glass-muted)] hover:bg-[var(--glass-10)] hover:text-white',
    );
  const headerCls = 'text-[9px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest text-center py-2 border-b border-[var(--glass-border)] sticky top-0 bg-[var(--dark-950)]/95 backdrop-blur-sm';

  return (
    <div className="flex border-t border-[var(--glass-border)]">
      <div ref={hourRef} className={cn(colCls, 'border-r border-[var(--glass-border)]')}>
        <p className={headerCls}>HR</p>
        {hours.map(h => (
          <button key={h} type="button" data-v={h} onClick={() => onHour(h)} className={itemCls(hour === h)}>
            {h}
          </button>
        ))}
      </div>
      <div ref={minRef} className={colCls}>
        <p className={headerCls}>MIN</p>
        {minutes.map(m => (
          <button key={m} type="button" data-v={m} onClick={() => onMinute(m)} className={itemCls(minute === m)}>
            {m}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Trigger button (shared) ──────────────────────────────────────────────────

interface TriggerProps {
  icon: React.ReactNode;
  hasValue: boolean;
  open: boolean;
  disabled?: boolean;
  error?: boolean;
  label?: string;
  required?: boolean;
  displayValue: string;
  placeholder: string;
  onClick: () => void;
}

function Trigger({ icon, hasValue, open, disabled, error, label, required, displayValue, placeholder, onClick }: TriggerProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[13px] font-bold text-[var(--on-glass-sub)] uppercase tracking-wide">
          {label}{required && <span className="text-[var(--danger-500)] ml-1">*</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm transition-all duration-200 outline-none text-left',
          'border-[var(--glass-border)]',
          open && 'border-[var(--primary-600)] ring-4 ring-[var(--primary-600)]/10',
          !open && 'hover:border-[var(--glass-high)] hover:bg-[var(--glass-10)] focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10',
          error && 'border-[var(--danger-500)]',
          disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
        )}
      >
        <span className={cn('flex-shrink-0 transition-colors', hasValue ? 'text-[var(--primary-600)]' : 'text-[var(--on-glass-dim)]')}>
          {icon}
        </span>
        <span className={cn('flex-1 min-w-0 truncate font-medium', hasValue ? 'text-white' : 'text-[var(--on-glass-dim)]')}>
          {hasValue ? displayValue : placeholder}
        </span>
        <ChevronRight
          size={14}
          className={cn('text-[var(--on-glass-dim)] transition-transform flex-shrink-0', open && 'rotate-90')}
        />
      </button>
    </div>
  );
}

// ─── Popup container ──────────────────────────────────────────────────────────

function Popup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'absolute top-full mt-2 left-0 z-50 bg-[var(--dark-950)]/95 backdrop-blur-xl border border-[var(--glass-border)] rounded-2xl shadow-2xl shadow-black/40 overflow-hidden',
      className,
    )}>
      {children}
    </div>
  );
}

// ─── DatePicker ───────────────────────────────────────────────────────────────

interface DatePickerProps {
  label?: string;
  value?: string;           // 'yyyy-MM-dd'
  onChange?: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  className?: string;
}

export function DatePicker({ label, value, onChange, placeholder = 'Select date', error, required, disabled, minDate, maxDate, className }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const initDate = value ? (() => { const [y, m] = value.split('-').map(Number); return { y, m: m - 1 }; })() : { y: new Date().getFullYear(), m: new Date().getMonth() };
  const [viewYear, setViewYear] = useState(initDate.y);
  const [viewMonth, setViewMonth] = useState(initDate.m);

  const close = () => setOpen(false);
  useOutsideClick(ref, close, open);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open]);

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  return (
    <div className={cn('relative', className)} ref={ref}>
      <Trigger
        icon={<Calendar size={15} />}
        hasValue={!!value}
        open={open}
        disabled={disabled}
        error={!!error}
        label={label}
        required={required}
        displayValue={value ? formatDateLabel(value) : ''}
        placeholder={placeholder}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <Popup className="w-72">
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            selectedDate={value}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={str => { onChange?.(str); close(); }}
            onPrev={prevMonth}
            onNext={nextMonth}
          />
        </Popup>
      )}
      {error && <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5 mt-1.5"><AlertTriangle size={12} />{error}</p>}
    </div>
  );
}

// ─── TimePicker ───────────────────────────────────────────────────────────────

interface TimePickerProps {
  label?: string;
  value?: string;           // 'HH:MM'
  onChange?: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  minuteStep?: number;
}

export function TimePicker({ label, value, onChange, placeholder = 'Select time', error, required, disabled, minuteStep = 5 }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const close = () => setOpen(false);
  useOutsideClick(ref, close, open);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open]);

  const [selH, selM] = value ? value.split(':') : ['', ''];

  const setH = (h: string) => onChange?.(`${h}:${selM || '00'}`);
  const setM = (m: string) => onChange?.(`${selH || '00'}:${m}`);

  return (
    <div className="relative" ref={ref}>
      <Trigger
        icon={<Clock size={15} />}
        hasValue={!!value}
        open={open}
        disabled={disabled}
        error={!!error}
        label={label}
        required={required}
        displayValue={value ?? ''}
        placeholder={placeholder}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <Popup className="w-44">
          {/* Current time display */}
          <div className="px-4 py-3 border-b border-[var(--glass-border)] text-center">
            <p className="text-xl font-black text-white font-mono tracking-widest">
              {selH || '——'}:{selM || '——'}
            </p>
          </div>
          <TimeColumns hour={selH} minute={selM} minuteStep={minuteStep} onHour={setH} onMinute={setM} />
        </Popup>
      )}
      {error && <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5 mt-1.5"><AlertTriangle size={12} />{error}</p>}
    </div>
  );
}

// ─── DateTimePicker ───────────────────────────────────────────────────────────

interface DateTimePickerProps {
  label?: string;
  value?: string;           // 'yyyy-MM-dd HH:MM'
  onChange?: (v: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string;
  maxDate?: string;
  minuteStep?: number;
}

function formatDateTimeLabel(v: string): string {
  const [datePart, timePart] = v.split(' ');
  const dateLabel = datePart ? formatDateLabel(datePart) : '';
  return timePart ? `${dateLabel} · ${timePart}` : dateLabel;
}

export function DateTimePicker({ label, value, onChange, placeholder = 'Select date & time', error, required, disabled, minDate, maxDate, minuteStep = 5 }: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const [datePart, timePart] = value ? value.split(' ') : ['', ''];
  const [selH, selM] = timePart ? timePart.split(':') : ['', ''];

  const initDate = datePart
    ? (() => { const [y, m] = datePart.split('-').map(Number); return { y, m: m - 1 }; })()
    : { y: new Date().getFullYear(), m: new Date().getMonth() };
  const [viewYear, setViewYear] = useState(initDate.y);
  const [viewMonth, setViewMonth] = useState(initDate.m);

  const close = () => setOpen(false);
  useOutsideClick(ref, close, open);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    if (open) document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [open]);

  const prevMonth = () => viewMonth === 0 ? (setViewYear(y => y - 1), setViewMonth(11)) : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0)) : setViewMonth(m => m + 1);

  const onDate = (d: string) => onChange?.(`${d} ${timePart || '00:00'}`);
  const onHour = (h: string) => onChange?.(`${datePart || toDateStr(new Date())} ${h}:${selM || '00'}`);
  const onMin = (m: string) => onChange?.(`${datePart || toDateStr(new Date())} ${selH || '00'}:${m}`);

  return (
    <div className="relative" ref={ref}>
      <Trigger
        icon={<Calendar size={15} />}
        hasValue={!!value}
        open={open}
        disabled={disabled}
        error={!!error}
        label={label}
        required={required}
        displayValue={value ? formatDateTimeLabel(value) : ''}
        placeholder={placeholder}
        onClick={() => setOpen(o => !o)}
      />
      {open && (
        <Popup className="w-72">
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            selectedDate={datePart}
            minDate={minDate}
            maxDate={maxDate}
            onSelect={onDate}
            onPrev={prevMonth}
            onNext={nextMonth}
          />
          {/* Time label */}
          <div className="flex items-center gap-3 px-4 py-2 bg-[var(--glass-05)]">
            <Clock size={13} className="text-[var(--on-glass-dim)] flex-shrink-0" />
            <p className="text-[10px] font-black text-[var(--on-glass-dim)] uppercase tracking-widest flex-1">Time</p>
            <p className="text-sm font-black text-white font-mono">
              {selH || '——'}:{selM || '——'}
            </p>
          </div>
          <TimeColumns hour={selH} minute={selM} minuteStep={minuteStep} onHour={onHour} onMinute={onMin} />
        </Popup>
      )}
      {error && <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5 mt-1.5"><AlertTriangle size={12} />{error}</p>}
    </div>
  );
}
