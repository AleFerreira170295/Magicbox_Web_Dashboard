interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function SectionHeader({ eyebrow, title, description, actions }: SectionHeaderProps) {
  return (
    <div className="flex min-w-0 flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 max-w-4xl">
        {eyebrow ? (
          <p className="inline-flex items-center gap-2 rounded-full border border-primary/12 bg-primary/8 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary/90">
            <span className="size-1.5 rounded-full bg-primary" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-foreground sm:text-[2.5rem]">{title}</h1>
        {description ? <p className="mt-3 max-w-3xl text-[15px] leading-7 text-muted-foreground sm:text-base">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
