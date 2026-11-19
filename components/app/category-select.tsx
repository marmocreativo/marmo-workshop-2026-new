import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/lib/types";

type Option = { value: string; label: string };

// Select nativo: muestra todas las categorías de un vistazo y en móvil abre el selector del sistema.
export function CategorySelect({
  value,
  onChange,
  categories,
  extra = [],
  className,
  "aria-label": ariaLabel = "Categoría",
}: {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
  extra?: Option[];
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className="h-10 w-full appearance-none rounded-xl border border-input bg-background pr-9 pl-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        {extra.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
        {extra.length > 0 && categories.length > 0 && <option disabled>──────────</option>}
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
