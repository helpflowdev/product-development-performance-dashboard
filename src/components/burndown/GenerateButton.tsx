interface GenerateButtonProps {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
}

export function GenerateButton({
  onClick,
  disabled = false,
  loading = false,
}: GenerateButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className="neon-btn px-6 py-2 text-white font-bold rounded-lg disabled:opacity-40 disabled:cursor-not-allowed border border-white/20 hover:border-white/40"
    >
      {loading ? 'Generating...' : 'Generate/Refresh'}
    </button>
  );
}
