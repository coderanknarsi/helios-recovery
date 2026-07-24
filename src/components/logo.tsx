import { cn } from "@/lib/utils";

/**
 * Helios sun mark — concentric sun with rays.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <svg
        viewBox="0 0 32 32"
        fill="none"
        className="h-8 w-8 shrink-0"
        aria-hidden="true"
      >
        <circle cx="16" cy="16" r="6.5" fill="var(--primary)" />
        {Array.from({ length: 12 }).map((_, i) => {
          const angle = (i * Math.PI) / 6;
          const x1 = 16 + Math.cos(angle) * 10;
          const y1 = 16 + Math.sin(angle) * 10;
          const x2 = 16 + Math.cos(angle) * 14;
          const y2 = 16 + Math.sin(angle) * 14;
          return (
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </svg>
      <span className="flex flex-col leading-none">
        <span className="font-serif text-lg font-semibold tracking-tight text-foreground">
          Helios
        </span>
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Recovery Residences
        </span>
      </span>
    </span>
  );
}
