import { cn } from "@/lib/utils";

export function Badge({ children, tone = "default", className }: { children: React.ReactNode; tone?: "default" | "accent"; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-1 text-meta",
        tone === "accent" ? "border-blue/40 text-blue-soft" : "border-line-strong text-ink-2",
        className,
      )}
    >
      {children}
    </span>
  );
}
