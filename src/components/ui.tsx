import React, { useEffect } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  X,
} from 'lucide-react';

export const StatusLabel: React.FC<{
  label: string;
  tone?: 'emerald' | 'amber' | 'rose' | 'slate' | 'navy';
}> = ({ label, tone = 'slate' }) => {
  const toneStyles: Record<string, string> = {
    emerald: 'text-[#059669]',
    amber: 'text-[#D97706]',
    rose: 'text-[#E11D48]',
    slate: 'text-slate-600',
    navy: 'text-[#0B132B]',
  };
  const Icon =
    tone === 'emerald'
      ? CheckCircle2
      : tone === 'amber'
        ? AlertTriangle
        : tone === 'rose'
          ? AlertCircle
          : Info;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${toneStyles[tone]}`}>
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </span>
  );
};

export const Badge: React.FC<{
  children: React.ReactNode;
  tone?: 'emerald' | 'amber' | 'rose' | 'slate' | 'navy';
}> = ({ children, tone = 'slate' }) => {
  const styles: Record<string, string> = {
    emerald: 'bg-emerald-50 text-[#059669] border-emerald-200',
    amber: 'bg-amber-50 text-[#B45309] border-amber-200',
    rose: 'bg-rose-50 text-[#E11D48] border-rose-200',
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    navy: 'bg-[#0B132B] text-white border-[#1C2541]',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border whitespace-nowrap ${styles[tone]}`}>
      {children}
    </span>
  );
};

export const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className={`bg-white border border-slate-200 rounded-xl shadow-[0_1px_2px_rgba(11,19,43,0.04)] ${className}`}>
    {children}
  </div>
);

export const Button: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
  }
> = ({ variant = 'primary', size = 'md', className = '', children, ...rest }) => {
  const styles: Record<string, string> = {
    primary: 'bg-[#059669] hover:bg-emerald-700 text-white border border-transparent',
    secondary: 'bg-white hover:bg-slate-50 text-slate-800 border border-slate-300',
    danger: 'bg-[#E11D48] hover:bg-rose-700 text-white border border-transparent',
    ghost: 'hover:bg-slate-100 text-slate-700 border border-transparent',
  };
  const sizes: Record<string, string> = {
    sm: 'min-h-[36px] px-3 py-1.5 text-xs',
    md: 'tap-target px-4 py-2 text-sm',
    lg: 'min-h-[48px] px-5 py-3 text-base',
  };
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap shrink-0 transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#059669] disabled:opacity-50 cursor-pointer ${styles[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  );
};

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}> = ({ title, description, eyebrow, actions }) => (
  <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
    <div className="min-w-0">
      {eyebrow && <div className="text-xs font-medium text-[#059669] mb-1">{eyebrow}</div>}
      <h1 className="text-2xl font-bold text-[#0B132B] tracking-tight">{title}</h1>
      {description && <p className="text-sm text-slate-600 mt-1 max-w-2xl">{description}</p>}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2 shrink-0">{actions}</div>}
  </div>
);

export const FormField: React.FC<{
  label: string;
  htmlFor?: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, htmlFor, hint, children }) => (
  <div className="space-y-1">
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700">
      {label}
    </label>
    {children}
    {hint && <p className="text-xs text-slate-500">{hint}</p>}
  </div>
);

export const InlineAlert: React.FC<{
  tone: 'error' | 'warning' | 'success' | 'info';
  children: React.ReactNode;
}> = ({ tone, children }) => {
  const styles: Record<string, string> = {
    error: 'bg-rose-50 border-rose-200 text-rose-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-950',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-950',
    info: 'bg-slate-100 border-slate-200 text-slate-800',
  };
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertTriangle : AlertCircle;
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`border rounded-lg px-4 py-3 text-sm flex items-start gap-2.5 ${styles[tone]}`}>
      <Icon className="h-4 w-4 shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
};

export const EmptyState: React.FC<{
  title: string;
  description: string;
  action?: React.ReactNode;
}> = ({ title, description, action }) => (
  <Card className="p-8 text-center">
    <h3 className="text-base font-semibold text-slate-900">{title}</h3>
    <p className="text-sm text-slate-600 mt-1 max-w-md mx-auto">{description}</p>
    {action && <div className="mt-4">{action}</div>}
  </Card>
);

export const LoadingSkeleton: React.FC<{ rows?: number }> = ({ rows = 4 }) => (
  <Card className="divide-y divide-slate-100">
    {Array.from({ length: rows }).map((_, idx) => (
      <div key={idx} className="p-4 flex items-center justify-between gap-4">
        <div className="space-y-2 flex-1">
          <div className="h-4 w-48 bg-slate-100 rounded" />
          <div className="h-3 w-32 bg-slate-100 rounded" />
        </div>
        <div className="h-4 w-20 bg-slate-100 rounded" />
      </div>
    ))}
  </Card>
);

export const ConfirmDialog: React.FC<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: 'danger' | 'primary';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ open, title, description, confirmLabel = 'Confirm', tone = 'danger', busy = false, onConfirm, onCancel }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-[#0B132B]/50 backdrop-blur-[1px]" onClick={onCancel} />
      <Card className="relative z-10 w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-[#0B132B]">{title}</h3>
          <button
            onClick={onCancel}
            aria-label="Close dialog"
            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-slate-600 leading-relaxed">{description}</p>
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export const Drawer: React.FC<{
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ open, title, subtitle, onClose, children }) => {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-[#0B132B]/45" onClick={onClose} />
      <div className="relative z-10 w-full max-w-xl bg-white h-full border-l border-slate-200 flex flex-col shadow-xl">
        <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#0B132B] truncate">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 mt-0.5 truncate">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close panel"
            className="tap-target p-2 -mr-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
};

export const Pagination: React.FC<{
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}> = ({ page, pageSize, total, onPageChange }) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/70 text-xs text-slate-600">
      <span className="font-mono tabular-nums">
        Showing {start}–{end} of {total}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-3.5 w-3.5" /> Prev
        </Button>
        <span className="px-2 font-mono tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Next <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

// Backwards-compatible alias for any callers
export const DataEmptyState = EmptyState;
export const SkeletonRows = LoadingSkeleton;
