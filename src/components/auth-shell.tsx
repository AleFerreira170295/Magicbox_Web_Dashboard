import type { ReactNode } from "react";

interface AuthShellProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <section className="w-full max-w-lg rounded-[36px] border border-white/70 bg-white/95 p-8 shadow-[0_24px_56px_rgba(66,128,164,0.12)] backdrop-blur">
      <div className="text-center">
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950">{title}</h1>
        {description ? <p className="mt-4 text-base leading-7 text-slate-600">{description}</p> : null}
      </div>
      <div className="mt-8">{children}</div>
    </section>
  );
}
