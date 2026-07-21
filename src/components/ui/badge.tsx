import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "primary" | "secondary" | "muted";

const badgeVariants: Record<BadgeVariant, string> = {
  primary:
    "bg-[color-mix(in_srgb,var(--primary)_12%,transparent)] text-[var(--primary)]",
  secondary:
    "bg-[color-mix(in_srgb,var(--secondary)_12%,transparent)] text-[var(--secondary)]",
  muted: "bg-[var(--muted)] text-[var(--muted-foreground)]",
};

export function Badge({
  className,
  variant = "muted",
  ...props
}: ComponentProps<"span"> & { variant?: BadgeVariant }) {
  return (
    <span
      data-slot="badge"
      className={cn(
        "inline-flex w-fit shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        badgeVariants[variant],
        className,
      )}
      {...props}
    />
  );
}
