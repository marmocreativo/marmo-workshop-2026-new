import Link from "next/link";
import { cn } from "@/lib/utils";
import { getModel, MODELS } from "@/lib/models";

function RatioGlyph({ ratio }: { ratio: string }) {
  const [a, b] = ratio === "auto" ? [1, 1] : ratio.split(":").map(Number);
  const k = 14 / Math.max(a, b);
  return (
    <span
      className={cn("inline-block border-[1.5px] border-current", ratio === "auto" && "border-dashed")}
      style={{ width: a * k, height: b * k, borderRadius: 2 }}
    />
  );
}

// Selector de proporción de la imagen de salida; solo ofrece las que soporta el modelo elegido.
export function RatioPicker({
  modelId,
  value,
  onChange,
}: {
  modelId: string;
  value: string;
  onChange: (ratio: string) => void;
}) {
  const model = getModel(modelId) ?? MODELS[0];
  if (model.ratios.length === 0) {
    return (
      <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
        {model.label} conserva la proporción de tu foto (no permite cambiarla).
      </p>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {["auto", ...model.ratios].map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => onChange(r)}
          className={cn(
            "flex h-9 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors",
            value === r ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted",
          )}
        >
          <RatioGlyph ratio={r} />
          {r === "auto" ? "Auto" : r}
        </button>
      ))}
    </div>
  );
}

// Costo en tokens de la generación elegida y saldo disponible.
export function TokenEstimate({
  modelId,
  cost,
  balance,
  bypass,
  className,
}: {
  modelId: string;
  cost: number | null;
  balance: number | undefined;
  bypass?: boolean;
  className?: string;
}) {
  const model = getModel(modelId);
  if (!model) return null;
  const short = !bypass && cost !== null && balance !== undefined && balance < cost;
  return (
    <div className={cn("flex items-center justify-between gap-3 text-sm", className)}>
      <span className="text-muted-foreground">
        {cost === null ? (
          "Este modelo no está disponible por ahora"
        ) : (
          <>
            Costo: <span className="font-semibold text-foreground">{bypass ? "0 (modo desarrollo)" : `${cost} tokens`}</span>{" "}
            <span className="text-xs">({model.kind === "video" ? "1 video" : "1 imagen"})</span>
          </>
        )}
      </span>
      <span className={cn("flex items-center gap-2", short ? "text-destructive" : "text-muted-foreground")}>
        {balance !== undefined && <>Saldo: <span className="font-semibold">{balance}</span></>}
        {short && (
          <Link href="/cuenta" className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-medium text-primary-foreground">
            Recargar
          </Link>
        )}
      </span>
    </div>
  );
}
