interface BadgeProps {
  label: string;
  variant?: 'default' | 'error' | 'warning' | 'info';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const colorMap = {
    default: 'bg-white/10 border border-white/20 text-slate-200',
    error: 'bg-rose-500/10 border border-rose-500/30 text-rose-400',
    warning: 'bg-amber-500/10 border border-amber-500/30 text-amber-400',
    info: 'bg-cyan-500/10 border border-cyan-500/30 text-cyan-400',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorMap[variant]}`}>
      {label}
    </span>
  );
}
