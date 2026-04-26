type StatusKind = "done" | "queued" | "failed";

interface Props {
  kind: StatusKind;
  label: string;
  className?: string;
}

const KIND_CLASS: Record<StatusKind, string> = {
  done: "text-status-done",
  queued: "text-status-queued",
  failed: "text-status-failed",
};

export function StatusPill({ kind, label, className = "" }: Props) {
  const colorClass = KIND_CLASS[kind];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-[3px] text-[10px] font-medium tracking-wide ${colorClass} ${className}`}
      style={{
        borderColor: `color-mix(in oklab, currentColor 30%, transparent)`,
        background: `color-mix(in oklab, currentColor 10%, transparent)`,
      }}
    >
      <span className="h-[5px] w-[5px] rounded-full bg-current" />
      {label}
    </span>
  );
}
