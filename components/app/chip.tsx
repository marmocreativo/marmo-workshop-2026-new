import { cn } from "@/lib/utils";

export function Chip({
  active,
  className,
  ...props
}: React.ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors active:scale-[0.98]",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
        className,
      )}
      {...props}
    />
  );
}

export function ChipRow({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4", className)} {...props} />;
}
