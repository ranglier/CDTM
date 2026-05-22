import type { ReactNode } from "react";

type AppShellProps = {
  children: ReactNode;
};

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.16),_transparent_32%),linear-gradient(180deg,_transparent,_hsl(var(--background-soft)/0.2))]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(90deg,_transparent,_hsl(var(--primary)/0.08),_transparent)] blur-3xl" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-[1560px] flex-1 flex-col gap-6 px-4 py-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
