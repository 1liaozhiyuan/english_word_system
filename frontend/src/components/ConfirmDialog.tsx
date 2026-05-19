import { AlertTriangle, CheckCircle2, X } from 'lucide-react';
import React from 'react';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '确认',
  cancelLabel = '取消',
  isLoading = false,
  tone = 'danger',
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isLoading?: boolean;
  tone?: 'danger' | 'normal';
  onCancel: () => void;
  onConfirm: () => void;
}) {
  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoading) onCancel();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, isLoading, onCancel]);

  if (!open) return null;

  const Icon = tone === 'danger' ? AlertTriangle : CheckCircle2;
  const iconColor = tone === 'danger' ? 'var(--red)' : 'var(--green)';
  const iconBackground = tone === 'danger' ? 'var(--red-soft)' : 'var(--green-soft)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
      <div
        className="w-full max-w-md rounded-lg border p-5 shadow-2xl"
        style={{ borderColor: 'var(--line)', background: 'var(--paper)' }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg"
              style={{ background: iconBackground, color: iconColor }}
            >
              <Icon size={22} />
            </div>
            <div className="min-w-0">
              <h2 id="confirm-title" className="text-xl font-semibold" style={{ color: 'var(--ink)' }}>
                {title}
              </h2>
              <p className="mt-2 text-sm leading-7" style={{ color: 'var(--muted)' }}>
                {description}
              </p>
            </div>
          </div>
          <button
            aria-label="关闭确认框"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
            disabled={isLoading}
            onClick={onCancel}
            style={{ color: 'var(--muted)' }}
            type="button"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button className="button-secondary" disabled={isLoading} onClick={onCancel} type="button">
            {cancelLabel}
          </button>
          <button
            className={tone === 'danger' ? 'button-danger' : 'button-primary'}
            disabled={isLoading}
            onClick={onConfirm}
            type="button"
          >
            {isLoading ? '处理中...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
