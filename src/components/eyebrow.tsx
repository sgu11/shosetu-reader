interface Props {
  children: React.ReactNode;
  className?: string;
}

export function Eyebrow({ children, className = "" }: Props) {
  return (
    <div
      className={`flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted ${className}`}
    >
      <span className="h-px w-4 bg-current opacity-40" />
      {children}
    </div>
  );
}
