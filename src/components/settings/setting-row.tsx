interface Props {
  label: string;
  hint?: string;
  children: React.ReactNode;
}

export function SettingRow({ label, hint, children }: Props) {
  return (
    <div className="grid items-start gap-6 border-b border-border py-5 md:grid-cols-[220px_1fr]">
      <div>
        <div className="font-serif text-[15px] font-medium text-foreground">
          {label}
        </div>
        {hint ? (
          <div className="mt-1 text-[11.5px] leading-relaxed text-muted">
            {hint}
          </div>
        ) : null}
      </div>
      <div>{children}</div>
    </div>
  );
}
