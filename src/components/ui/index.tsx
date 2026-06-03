'use client';
import { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, useEffect, useRef } from 'react';
import { cn, getInitials } from '@/lib/utils';
import { X, Loader2, AlertTriangle, ChevronRight } from 'lucide-react';

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
    primary: 'bg-[var(--primary-600)] text-white hover:bg-[var(--primary-900)] hover:shadow-lg hover:shadow-[var(--primary-600)]/20 focus-visible:ring-[var(--primary-100)]',
    ghost:   'bg-transparent text-[var(--gray-600)] hover:bg-[var(--gray-100)] hover:text-[var(--dark-950)]',
    danger:  'bg-[var(--danger-50)] text-[var(--danger-800)] hover:bg-[var(--danger-100)] focus-visible:ring-[var(--danger-100)]',
    outline: 'bg-white text-[var(--dark-950)] border border-[var(--gray-200)] hover:bg-[var(--gray-50)] hover:border-[var(--gray-300)] shadow-sm',
    success: 'bg-[var(--success-100)] text-[var(--success-700)] hover:bg-[var(--success-200)]',
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
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={inputId} className="text-sm font-semibold text-[var(--dark-800)]">
          {label}{props.required && <span className="text-[var(--danger-500)] ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--gray-500)]">{leftIcon}</span>}
        <input
          id={inputId}
          className={cn(
            'w-full rounded-lg border bg-white px-3 py-2 text-sm text-[var(--dark-950)] placeholder:text-[var(--gray-500)]',
            'transition-colors duration-150',
            'border-[var(--gray-200)] focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)] outline-none',
            error && 'border-[var(--danger-500)] focus:ring-[var(--danger-100)]',
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className
          )}
          {...props}
        />
        {rightIcon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--gray-500)]">{rightIcon}</span>}
      </div>
      {error && <p className="text-xs text-[var(--danger-800)] flex items-center gap-1"><AlertTriangle size={10} />{error}</p>}
      {hint && !error && <p className="text-xs text-[var(--gray-500)]">{hint}</p>}
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
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={selectId} className="text-sm font-semibold text-[var(--dark-800)]">
          {label}{props.required && <span className="text-[var(--danger-500)] ml-0.5">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          'w-full rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm text-[var(--dark-950)]',
          'focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)] outline-none transition-colors',
          error && 'border-[var(--danger-500)]',
          className
        )}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      {error && <p className="text-xs text-[var(--danger-800)] flex items-center gap-1"><AlertTriangle size={10} />{error}</p>}
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
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={taId} className="text-sm font-semibold text-[var(--dark-800)]">
          {label}{props.required && <span className="text-[var(--danger-500)] ml-0.5">*</span>}
        </label>
      )}
      <textarea
        id={taId}
        rows={3}
        className={cn(
          'w-full rounded-lg border border-[var(--gray-200)] bg-white px-3 py-2 text-sm text-[var(--dark-950)] resize-none',
          'focus:border-[var(--primary-600)] focus:ring-2 focus:ring-[var(--primary-100)] outline-none transition-colors',
          error && 'border-[var(--danger-500)]',
          className
        )}
        {...props}
      />
      {error && <p className="text-xs text-[var(--danger-800)] flex items-center gap-1"><AlertTriangle size={10} />{error}</p>}
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
      className={cn('inline-flex items-center font-semibold rounded-full', size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs')}
      style={{ color, backgroundColor: bg }}
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
    <div className={cn('bg-white rounded-2xl border border-[var(--gray-200)] shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden', className)}>
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
    <Card className="p-5 hover:shadow-md transition-all duration-200 group">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-[13px] text-[var(--gray-500)] font-semibold uppercase tracking-wider">{title}</p>
          <p className="text-3xl font-black mt-2 tracking-tight" style={{ color }}>{value}</p>
          {delta && (
            <div className={cn('inline-flex items-center gap-1 mt-2.5 px-2 py-0.5 rounded-full text-[11px] font-bold', deltaPositive ? 'bg-[var(--success-100)] text-[var(--success-700)]' : 'bg-[var(--danger-50)] text-[var(--danger-800)]')}>
              <span>{deltaPositive ? '↑' : '↓'}</span>
              <span>{delta}</span>
            </div>
          )}
        </div>
        <div className="w-12 h-12 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110 group-hover:rotate-3 shadow-sm" style={{ backgroundColor: bg, color }}>
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-animate"
      style={{ backgroundColor: 'rgba(15,23,42,0.5)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className={cn('w-full bg-white rounded-2xl shadow-2xl modal-animate flex flex-col max-h-[90vh]', sizes[size])}>
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-[var(--gray-200)] flex-shrink-0">
          <h2 className="text-lg font-bold text-[var(--dark-950)]">{title}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--gray-500)] hover:bg-[var(--gray-100)] hover:text-[var(--dark-950)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1">{children}</div>
        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 p-6 border-t border-[var(--gray-200)] flex-shrink-0">
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
  return <div className={cn('animate-pulse rounded-lg bg-[var(--gray-100)]', className)} />;
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
      <div className="w-14 h-14 rounded-2xl bg-[var(--gray-100)] flex items-center justify-center text-[var(--gray-500)] mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-[var(--dark-950)] mb-1">{title}</h3>
      <p className="text-sm text-[var(--gray-500)] mb-4 max-w-xs">{description}</p>
      {action}
    </div>
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
    <div className="flex items-start justify-between mb-6">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1 mb-1">
            {breadcrumb.map((crumb, i) => (
              <span key={crumb.label} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={12} className="text-[var(--gray-500)]" />}
                {crumb.href ? (
                  <a href={crumb.href} className="text-xs text-[var(--primary-600)] hover:underline">{crumb.label}</a>
                ) : (
                  <span className="text-xs text-[var(--gray-500)]">{crumb.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl font-bold text-[var(--dark-950)]">{title}</h1>
        {subtitle && <p className="text-sm text-[var(--gray-500)] mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
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
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--gray-200)]">
            {headers.map(h => (
              <th key={h} className="text-left text-xs font-semibold text-[var(--gray-500)] uppercase tracking-wide py-3 px-4 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <tr key={i} className="border-b border-[var(--gray-100)]">
                {headers.map((h) => (
                  <td key={h} className="py-3 px-4"><Skeleton className="h-4 w-full" /></td>
                ))}
              </tr>
            ))
          ) : children}
        </tbody>
      </table>
      {!loading && emptyState}
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
    <div className="absolute right-0 top-8 z-10 min-w-[160px] bg-white rounded-xl shadow-lg border border-[var(--gray-200)] py-1 fade-in-up">
      {items.map((item) => (
        <button
          key={item.label}
          onClick={item.onClick}
          className={cn(
            'w-full text-left px-4 py-2 text-sm flex items-center gap-2 transition-colors',
            item.danger
              ? 'text-[var(--danger-800)] hover:bg-[var(--danger-100)]'
              : 'text-[var(--dark-950)] hover:bg-[var(--gray-50)]'
          )}
        >
          {item.icon}{item.label}
        </button>
      ))}
    </div>
  );
}

// ─── Notification Toast wrapper (used with react-hot-toast) ─
export { default as toast } from 'react-hot-toast';
