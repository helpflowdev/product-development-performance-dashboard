interface BadgeProps {
  label: string;
  variant?: 'default' | 'error' | 'warning' | 'info';
}

export function Badge({ label, variant = 'default' }: BadgeProps) {
  const colorMap = {
    default: 'bg-gray-100 text-gray-800',
    error: 'bg-red-100 text-red-800',
    warning: 'bg-yellow-100 text-yellow-800',
    info: 'bg-blue-100 text-blue-800',
  };

  return (
    <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${colorMap[variant]}`}>
      {label}
    </span>
  );
}
