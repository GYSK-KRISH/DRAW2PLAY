import React from 'react';

interface StatusBadgeProps {
  label: string;
  variant?: 'success' | 'warning' | 'info' | 'theme';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ label, variant = 'info' }) => {
  const styles = {
    success: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    warning: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    info: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    theme: 'bg-gradient-to-r from-amber-500/20 to-indigo-500/20 text-amber-300 border-amber-500/40 font-semibold',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium tracking-wide ${styles[variant]}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
      {label}
    </span>
  );
};
