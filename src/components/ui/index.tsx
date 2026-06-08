'use client';
import {
  ReactNode,
  Children,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn, getInitials } from '@/lib/utils';
import { shouldShowTableEmptyState } from './table.utils';

export { shouldShowTableEmptyState } from './table.utils';
import { X, Loader2, AlertTriangle, ChevronRight, MoreHorizontal, ChevronDown, Check as CheckIcon } from 'lucide-react';

// ─── Button ───────────────────────────────────────────
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost' | 'danger' | 'outline' | 'success';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Button({
  variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 font-bold rounded-xl transition-all duration-200 focus-visible:ring-4 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-95';
  const variants = {
    primary: 'bg-[var(--primary-600)] text-white hover:brightness-110 hover:shadow-lg hover:shadow-[var(--primary-600)]/30 focus-visible:ring-[var(--primary-600)]/20',
    ghost:   'bg-[var(--glass-05)] text-[var(--on-glass-sub)] hover:bg-[var(--glass-10)] hover:text-white border border-[var(--glass-border)]',
    danger:  'bg-[var(--danger-800)]/20 text-[var(--danger-500)] hover:bg-[var(--danger-500)]/20 border border-[var(--danger-500)]/30 focus-visible:ring-[var(--danger-500)]/20',
    outline: 'bg-transparent text-white border border-[var(--glass-border)] hover:bg-[var(--glass-05)] hover:border-[var(--glass-high)] shadow-sm',
    success: 'bg-[var(--success-700)]/20 text-[var(--success-500)] hover:bg-[var(--success-500)]/20 border border-[var(--success-500)]/30',
  };
  const sizes = {
    sm: 'px-4 py-1.5 text-[13px]',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-7 py-3.5 text-base',
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} disabled={disabled || loading} {...props}>
      {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ─── Input ────────────────────────────────────────────
interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  className?: string;
  id?: string;
  required?: boolean;
}

export function Input({ label, error, hint, leftIcon, rightIcon, className, id, ...props }: InputProps) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-[13px] font-bold text-[var(--on-glass-sub)] uppercase tracking-wide">
          {label}{props.required && <span className="text-[var(--danger-500)] ml-1">*</span>}
        </label>
      )}
      <div className="relative group">
        {leftIcon && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)] group-focus-within:text-[var(--primary-600)] transition-colors">{leftIcon}</span>}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white placeholder:text-[var(--on-glass-dim)]',
            'transition-all duration-200',
            'border-[var(--glass-border)] focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none',
            error && 'border-[var(--danger-500)] focus:ring-[var(--danger-500)]/10',
            leftIcon && 'pl-11',
            rightIcon && 'pr-11',
            className
          )}
          {...props}
        />
        {rightIcon && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--on-glass-dim)]">{rightIcon}</span>}
      </div>
      {error && <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5 mt-0.5"><AlertTriangle size={12} />{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--on-glass-dim)]">{hint}</p>}
    </div>
  );
}

// ─── Select ───────────────────────────────────────────
interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export function Select({ label, error, options, placeholder, className, id, ...props }: SelectProps) {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-[13px] font-bold text-[var(--on-glass-sub)] uppercase tracking-wide">
          {label}{props.required && <span className="text-[var(--danger-500)] ml-1">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white appearance-none cursor-pointer',
          'transition-all duration-200',
          'border-[var(--glass-border)] focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none',
          error && 'border-[var(--danger-500)] focus:ring-[var(--danger-500)]/10',
          className
        )}
        {...props}
      >
        {placeholder && <option value="" className="bg-[var(--dark-950)]">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value} className="bg-[var(--dark-950)]">{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5 mt-0.5"><AlertTriangle size={12} />{error}</p>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────
interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  className?: string;
  id?: string;
  required?: boolean;
}

export function Textarea({ label, error, className, id, ...props }: TextareaProps) {
  const taId = id || label?.toLowerCase().replace(/\s+/g, '-');
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={taId} className="text-[13px] font-bold text-[var(--on-glass-sub)] uppercase tracking-wide">
          {label}{props.required && <span className="text-[var(--danger-500)] ml-1">*</span>}
        </label>
      )}
      <textarea
        id={taId}
        rows={3}
        className={cn(
          'w-full rounded-xl border bg-[var(--glass-05)] px-4 py-3 text-sm text-white placeholder:text-[var(--on-glass-dim)] resize-none',
          'transition-all duration-200',
          'border-[var(--glass-border)] focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none',
          error && 'border-[var(--danger-500)] focus:ring-[var(--danger-500)]/10',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger-500)] font-medium flex items-center gap-1.5 mt-0.5"><AlertTriangle size={12} />{error}</p>}
    </div>
  );
}

// ─── Badge / Status ───────────────────────────────────
interface BadgeProps {
  label: string;
  color: string;
  bg: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, color, bg, size = 'md' }: BadgeProps) {
  return (
    <span
      className={cn('inline-flex items-center font-bold rounded-full uppercase tracking-wider shadow-sm', size === 'sm' ? 'px-3 py-1 text-[10px]' : 'px-4 py-1.5 text-xs')}
      style={{ color, backgroundColor: bg + '20', border: `1px solid ${bg}40` }}
    >
      {label}
    </span>
  );
}

// ─── Avatar ───────────────────────────────────────────
interface AvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export function Avatar({ name, imageUrl, size = 'md' }: AvatarProps) {
  const sizes = { xs: 'w-6 h-6 text-xs', sm: 'w-8 h-8 text-xs', md: 'w-10 h-10 text-sm', lg: 'w-12 h-12 text-base', xl: 'w-16 h-16 text-xl', '2xl': 'w-24 h-24 text-2xl' };
  return (
    <div className={cn('rounded-full flex items-center justify-center font-semibold text-white bg-[var(--primary-600)] overflow-hidden flex-shrink-0', sizes[size])}>
      {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : getInitials(name)}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-[var(--glass-10)] backdrop-blur-md rounded-2xl border border-[var(--glass-border)] shadow-xl overflow-hidden', className)}>
      {children}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────
interface KPICardProps {
  title: string;
  value: number | string;
  icon: ReactNode;
  color: string;
  bg: string;
  delta?: string;
  deltaPositive?: boolean;
}

export function KPICard({ title, value, icon, color, bg, delta, deltaPositive }: KPICardProps) {
  return (
    <Card className="p-4 hover:bg-[var(--glass-15)] hover:border-[var(--glass-high)] transition-all duration-300 group cursor-default">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[10px] text-[var(--on-glass-muted)] font-black uppercase tracking-[0.1em]">{title}</p>
          <p className="text-2xl font-black mt-2 tracking-tight text-white group-hover:text-[var(--primary-600)] transition-colors">{value}</p>
          {delta && (
            <div className={cn('inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider', deltaPositive ? 'bg-[var(--success-500)]/20 text-[var(--success-500)]' : 'bg-[var(--danger-500)]/20 text-[var(--danger-500)]')}>
              <span>{deltaPositive ? '↑' : '↓'}</span>
              <span>{delta}</span>
            </div>
          )}
        </div>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 shadow-lg" style={{ backgroundColor: bg + '20', color: bg, border: `1px solid ${bg}40` }}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

// ─── Modal ────────────────────────────────────────────
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  footer?: ReactNode;
}

export function Modal({ isOpen, onClose, title, children, size = 'md', footer }: ModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    if (isOpen) window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizes = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md backdrop-animate"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={cn('w-full bg-[var(--dark-950)]/80 backdrop-blur-xl rounded-2xl border border-[var(--glass-border)] shadow-2xl modal-animate flex flex-col max-h-[85vh] overflow-hidden', sizes[size])}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[var(--glass-border)] flex-shrink-0">
          <h2 className="text-base font-black text-white tracking-tight">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--on-glass-dim)] hover:bg-[var(--glass-10)] hover:text-white transition-all active:scale-90"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 custom-scrollbar">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-[var(--glass-border)] bg-[var(--glass-05)] flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Confirm Dialog ───────────────────────────────────
interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'primary';
  loading?: boolean;
}

export function ConfirmDialog({ isOpen, onClose, onConfirm, title, message, confirmLabel = 'Confirm', variant = 'danger', loading }: ConfirmDialogProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>{confirmLabel}</Button>
        </>
      }
    >
      <p className="text-sm text-[var(--gray-500)]">{message}</p>
    </Modal>
  );
}

// ─── Skeleton ─────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-lg bg-[var(--glass-10)] border border-[var(--glass-border)]',
        className,
      )}
    />
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 py-3">
      <Skeleton className="w-10 h-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-3 w-24" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────
interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-[var(--glass-10)] border border-[var(--glass-border)] flex items-center justify-center text-[var(--on-glass-muted)] mb-4">
        {icon}
      </div>
      <h3 className="text-base font-bold text-white mb-1">{title}</h3>
      <p className="text-sm text-[var(--on-glass-muted)] mb-4 max-w-xs">{description}</p>
      {action}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────
export interface TabItem {
  id: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface TabsProps {
  tabs: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  variant?: 'underline' | 'pill';
  className?: string;
}

export function Tabs({ tabs, activeId, onChange, variant = 'underline', className }: TabsProps) {
  if (variant === 'pill') {
    return (
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            disabled={tab.disabled}
            onClick={() => onChange(tab.id)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all',
              activeId === tab.id
                ? 'bg-[var(--primary-600)] text-white shadow-lg shadow-[var(--primary-600)]/20'
                : 'bg-[var(--glass-05)] text-[var(--on-glass-muted)] border border-[var(--glass-border)] hover:bg-[var(--glass-10)] hover:text-white',
              tab.disabled && 'opacity-50 cursor-not-allowed',
            )}
          >
            {tab.icon}{tab.label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex items-center gap-1 overflow-x-auto border-b border-[var(--glass-border)]',
        className,
      )}
    >
      {tabs.map(tab => (
        <button
          key={tab.id}
          type="button"
          disabled={tab.disabled}
          onClick={() => onChange(tab.id)}
          className={cn(
            'inline-flex items-center gap-2 px-6 py-4 text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap border-b-2 -mb-px',
            activeId === tab.id
              ? 'text-[var(--primary-600)] border-[var(--primary-600)]'
              : 'text-[var(--on-glass-dim)] border-transparent hover:text-white',
            tab.disabled && 'opacity-50 cursor-not-allowed',
          )}
        >
          {tab.icon}{tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Status select (employee / org tables) ────────────
export type EntityStatus = 'active' | 'inactive' | 'suspended';

const STATUS_OPTIONS: { value: EntityStatus; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'suspended', label: 'Suspended' },
];

interface StatusSelectProps {
  value: EntityStatus;
  onChange: (value: EntityStatus) => void;
  disabled?: boolean;
  allowed?: EntityStatus[];
  size?: 'sm' | 'md';
  className?: string;
}

export function StatusSelect({
  value,
  onChange,
  disabled,
  allowed,
  size = 'sm',
  className,
}: StatusSelectProps) {
  const options = allowed
    ? STATUS_OPTIONS.filter(o => allowed.includes(o.value))
    : STATUS_OPTIONS;

  return (
    <select
      value={value}
      disabled={disabled}
      onChange={e => onChange(e.target.value as EntityStatus)}
      className={cn(
        'rounded-xl border bg-[var(--glass-05)] font-bold text-white appearance-none cursor-pointer',
        'border-[var(--glass-border)] focus:border-[var(--primary-600)] focus:ring-4 focus:ring-[var(--primary-600)]/10 outline-none transition-all',
        size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2.5 text-sm',
        disabled && 'opacity-50 cursor-not-allowed',
        className,
      )}
    >
      {options.map(o => (
        <option key={o.value} value={o.value} className="bg-[var(--dark-950)]">
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ─── Page Header ──────────────────────────────────────
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumb?: { label: string; href?: string }[];
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumb, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1.5 mb-2">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={12} className="text-[var(--on-glass-dim)]" />}
                {crumb.href ? (
                  <a href={crumb.href} className="text-xs font-bold text-[var(--primary-600)] hover:text-[var(--secondary)] transition-colors">{crumb.label}</a>
                ) : (
                  <span className="text-xs font-bold text-[var(--on-glass-muted)]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-black text-white tracking-tight">{title}</h1>
        {subtitle && <p className="text-xs font-medium text-[var(--on-glass-muted)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5">{actions}</div>}
    </div>
  );
}

// ─── Table ────────────────────────────────────────────
interface TableProps {
  headers: string[];
  children: ReactNode;
  loading?: boolean;
  emptyState?: ReactNode;
}

export function Table({ headers, children, loading, emptyState }: TableProps) {
  const rowCount = Children.count(children);
  const showEmpty = shouldShowTableEmptyState(loading, rowCount);

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--glass-border)]">
            {headers.map(h => (
              <th key={h} className="text-left text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em] py-4 px-6 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--glass-border)]">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {headers.map((h) => (
                  <td key={h} className="py-4 px-6"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            ))
          ) : showEmpty ? (
            <tr>
              <td colSpan={headers.length} className="py-4 px-6">
                {emptyState}
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── DataTable ────────────────────────────────────────
export interface DataTableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  className?: string;
  render: (row: T) => ReactNode;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string;
  loading?: boolean;
  emptyState?: ReactNode;
  page?: number;
  pageSize?: number;
  total?: number;
  onPageChange?: (page: number) => void;
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  rowActions?: (row: T) => ActionMenuItem[];
}

function DataTableRowMenu({ items }: { items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative flex justify-end" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-[var(--glass-10)] text-[var(--on-glass-dim)] hover:text-white transition-all"
        aria-label="Row actions"
      >
        <MoreHorizontal size={20} />
      </button>
      {open && (
        <ActionMenu
          items={items.map(item => ({
            ...item,
            onClick: () => {
              setOpen(false);
              item.onClick();
            },
          }))}
        />
      )}
    </div>
  );
}

function DataTableSortableHeader({
  label,
  columnKey,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  columnKey: string;
  sortKey?: string;
  sortDir: 'asc' | 'desc';
  onSort?: (key: string) => void;
}) {
  const active = sortKey === columnKey;
  return (
    <button
      type="button"
      onClick={() => onSort?.(columnKey)}
      className="inline-flex items-center gap-1 hover:text-white transition-colors"
    >
      {label}
      {active && <span className="text-[10px] text-[var(--primary-600)]">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </button>
  );
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  loading,
  emptyState,
  page = 1,
  pageSize,
  total,
  onPageChange,
  sortKey,
  sortDir = 'asc',
  onSort,
  rowActions,
}: DataTableProps<T>) {
  const rowCount = data.length;
  const showEmpty = shouldShowTableEmptyState(loading, rowCount);
  const pageCount = pageSize && total != null ? Math.max(1, Math.ceil(total / pageSize)) : null;

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--glass-border)]">
              {columns.map(col => (
                <th
                  key={col.key}
                  className="text-left text-[11px] font-black text-[var(--on-glass-muted)] uppercase tracking-[0.1em] py-4 px-6 whitespace-nowrap"
                >
                  {col.sortable && onSort ? (
                    <DataTableSortableHeader
                      label={col.header}
                      columnKey={col.key}
                      sortKey={sortKey}
                      sortDir={sortDir}
                      onSort={onSort}
                    />
                  ) : (
                    col.header
                  )}
                </th>
              ))}
              {rowActions && <th className="py-4 px-6" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {columns.map(col => (
                    <td key={col.key} className="py-4 px-6">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                  {rowActions && <td className="py-4 px-6" />}
                </tr>
              ))
            ) : showEmpty ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0)} className="py-4 px-6">
                  {emptyState}
                </td>
              </tr>
            ) : (
              data.map(row => (
                <tr key={rowKey(row)} className="hover:bg-[var(--glass-05)] transition-all group">
                  {columns.map(col => (
                    <td key={col.key} className={cn('py-4 px-6', col.className)}>
                      {col.render(row)}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="py-4 px-6">
                      <DataTableRowMenu items={rowActions(row)} />
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {pageCount != null && pageCount > 1 && onPageChange && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-medium text-[var(--on-glass-muted)]">
            Page {page} of {pageCount}
            {total != null && ` · ${total} total`}
          </p>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={page >= pageCount}
              onClick={() => onPageChange(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Dot menu / Actions ───────────────────────────────
interface ActionMenuItem {
  label: string;
  icon?: ReactNode;
  onClick: () => void;
  danger?: boolean;
}

export function ActionMenu({ items }: { items: ActionMenuItem[] }) {
  return (
    <div className="absolute right-0 top-10 z-10 min-w-[200px] bg-[var(--dark-950)]/90 backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--glass-border)] py-2 fade-in-up overflow-hidden">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={cn(
            'w-full text-left px-5 py-3 text-[13px] font-bold flex items-center gap-3 transition-all active:bg-[var(--glass-10)]',
            item.danger
              ? 'text-[var(--danger-500)] hover:bg-[var(--danger-500)]/10'
              : 'text-white hover:bg-[var(--glass-10)]'
          )}
        >
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────
export interface DropdownOption {
  value: string;
  label: string;
}

interface DropdownProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function Dropdown({ label, value, onChange, options, placeholder, error, required, disabled, className }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    if (open) document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  const selected = options.find(o => o.value === value);

  return (
    <div className={cn('flex flex-col gap-1.5', className)} ref={ref}>
      {label && (
        <label className="text-[13px] font-bold text-(--on-glass-sub) uppercase tracking-wide">
          {label}{required && <span className="text-(--danger-500) ml-1">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(o => !o)}
          className={cn(
            'w-full flex items-center gap-2.5 rounded-xl border bg-(--glass-05) px-3.5 py-2.5 text-sm transition-all duration-200 outline-none',
            'border-(--glass-border) focus:border-(--primary-600) focus:ring-4 focus:ring-(--primary-600)/10',
            open && 'border-(--primary-600) ring-4 ring-(--primary-600)/10',
            !open && 'hover:border-(--glass-high) hover:bg-(--glass-10)',
            error && 'border-(--danger-500)',
            disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
          )}
        >
          <span className={cn('flex-1 min-w-0 truncate font-medium text-left', selected ? 'text-white' : 'text-(--on-glass-dim)')}>
            {selected ? selected.label : (placeholder || 'Select…')}
          </span>
          <ChevronDown size={14} className={cn('text-(--on-glass-dim) transition-transform shrink-0', open && 'rotate-180')} />
        </button>
        {open && (
          <div className="absolute top-full mt-1.5 left-0 right-0 z-50 bg-(--dark-950)/95 backdrop-blur-xl border border-(--glass-border) rounded-xl shadow-2xl overflow-hidden fade-in-up">
            {placeholder && (
              <button
                type="button"
                onClick={() => { onChange(''); setOpen(false); }}
                className={cn('w-full text-left px-4 py-2.5 text-sm transition-all flex items-center gap-2',
                  !value ? 'bg-(--primary-600) text-white font-bold' : 'text-(--on-glass-dim) hover:bg-(--glass-10) hover:text-white')}
              >
                {!value && <CheckIcon size={12} className="shrink-0" />}
                {placeholder}
              </button>
            )}
            {options.map(o => (
              <button
                key={o.value}
                type="button"
                onClick={() => { onChange(o.value); setOpen(false); }}
                className={cn('w-full text-left px-4 py-2.5 text-sm font-medium transition-all flex items-center gap-2',
                  o.value === value ? 'bg-(--primary-600) text-white font-bold' : 'text-white hover:bg-(--glass-10)')}
              >
                {o.value === value && <CheckIcon size={12} className="shrink-0" />}
                <span className={o.value !== value ? 'pl-4' : ''}>{o.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-(--danger-500) font-medium flex items-center gap-1.5 mt-0.5"><AlertTriangle size={12} />{error}</p>}
    </div>
  );
}

// ─── StatBox ───────────────────────────────────────────────
interface StatBoxProps {
  label: string;
  labelIcon?: ReactNode;
  value: ReactNode;
  note?: ReactNode;
  noteColor?: string;
  className?: string;
}
export function StatBox({ label, labelIcon, value, note, noteColor, className }: StatBoxProps) {
  return (
    <div className={cn('panel', className)}>
      <p className="label-xs flex items-center gap-1 mb-1.5">{labelIcon}{label}</p>
      <div className="text-base font-black text-white">{value}</div>
      {note && <p className="text-[10px] font-bold mt-0.5" style={{ color: noteColor ?? 'var(--on-glass-dim)' }}>{note}</p>}
    </div>
  );
}

// ─── SectionCard ───────────────────────────────────────────
interface SectionCardProps {
  icon?: ReactNode;
  iconColor?: string;
  title: string;
  count?: number;
  countColor?: string;
  children: ReactNode;
  className?: string;
  accentColor?: string;
}
export function SectionCard({ icon, iconColor, title, count, countColor, children, className, accentColor }: SectionCardProps) {
  const cc = countColor ?? accentColor ?? 'var(--primary-600)';
  return (
    <Card
      className={cn('p-4', className)}
      style={accentColor ? { borderColor: accentColor + '33', backgroundColor: accentColor + '0D' } : undefined}
    >
      <div className="flex items-center gap-2.5 mb-3">
        {icon && <span style={{ color: iconColor ?? accentColor }}>{icon}</span>}
        <h3 className="text-xs font-black text-white uppercase tracking-widest flex-1">{title}</h3>
        {count != null && (
          <span className="text-[10px] font-black px-2 py-0.5 rounded-full" style={{ color: cc, backgroundColor: cc + '28' }}>
            {count}
          </span>
        )}
      </div>
      {children}
    </Card>
  );
}

// ─── RequestItem ───────────────────────────────────────────
interface RequestItemProps {
  name: string;
  avatarUrl?: string;
  primary: string;
  primaryColor?: string;
  secondary?: string;
  onApprove?: () => void;
  onReject?: () => void;
  loading?: boolean;
  actions?: ReactNode;
}
export function RequestItem({ name, avatarUrl, primary, primaryColor, secondary, onApprove, onReject, loading, actions }: RequestItemProps) {
  return (
    <div className="item-row">
      <Avatar name={name} imageUrl={avatarUrl} size="sm" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white truncate">{name}</p>
        <p className="text-[10px] truncate" style={{ color: primaryColor ?? 'var(--on-glass-muted)' }}>{primary}</p>
        {secondary && <p className="text-[10px] text-[var(--on-glass-dim)] truncate">{secondary}</p>}
      </div>
      {actions ?? ((onApprove || onReject) && (
        <div className="flex gap-1.5 shrink-0">
          {onApprove && <button onClick={onApprove} disabled={loading} className="action-btn action-btn-approve"><Check size={12} /></button>}
          {onReject  && <button onClick={onReject}  disabled={loading} className="action-btn action-btn-reject"><X size={12} /></button>}
        </div>
      ))}
    </div>
  );
}

// ─── Role Badge ────────────────────────────────────────────
const ROLE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  super_admin:    { label: 'Super Admin',  color: '#a78bfa', bg: '#8b5cf6' },
  hr_admin:       { label: 'HR Admin',     color: '#38bdf8', bg: '#0ea5e9' },
  manager:        { label: 'Manager',      color: '#00C896', bg: '#00C896' },
  employee:       { label: 'Employee',     color: '#94a3b8', bg: '#64748b' },
  platform_admin: { label: 'Platform',     color: '#f59e0b', bg: '#f59e0b' },
};

export function RoleBadge({ role, size = 'sm' }: { role: string; size?: 'sm' | 'md' }) {
  const s = ROLE_STYLES[role] ?? { label: role.replace(/_/g, ' '), color: '#94a3b8', bg: '#64748b' };
  return <Badge label={s.label} color={s.color} bg={s.bg} size={size} />;
}

// ─── Notification Toast wrapper (used with react-hot-toast) ─
export { default as toast } from 'react-hot-toast';

// ─── Date & Time Pickers ──────────────────────────────
export { DatePicker, TimePicker, DateTimePicker } from './date-picker';
