import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, Images, Layers, ScanSearch, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { getUser } from "@/lib/auth";
import { getPricing, listPacks, listPlans } from "@/lib/billing";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import { MODELS } from "@/lib/models";
import { formatMxn, formatTokens, tokensFor } from "@/lib/tokens";
import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Photo Studio",
    text: "Sube la foto de una persona o un grupo y transfórmala con la IA que prefieras.",
  },
  {
    icon: Layers,
    title: "Biblioteca de modificadores",
    text: "Iluminación, pose, encuadre, lente, outfit, cabello, fondo y más. Crea, edita y marca favoritos.",
  },
  {
    icon: ScanSearch,
    title: "Analiza una imagen",
    text: "Gemini describe una foto y la convierte en modificadores listos para reutilizar.",
  },
  {
    icon: Images,
    title: "Galería con memoria",
    text: "Cada resultado recuerda qué modificadores usaste, para saber cuáles funcionan mejor.",
  },
];

const NAV = [
  { href: "#inicio", label: "Inicio" },
  { href: "#funciones", label: "Funciones" },
  { href: "#modelos", label: "Modelos" },
  { href: "#precio", label: "Precio" },
];

const glass = "border border-white/10 bg-white/[0.06] backdrop-blur-md";

export default async function Home() {
  const user = await getUser();
  const [plans, packs, pricing] = await Promise.all([listPlans(), listPacks(), getPricing()]);
  const nanoTokens = tokensFor(MODELS[0], "auto", pricing) ?? 1;
  const cta =user ? { href: "/studio", label: "Abrir Studio" } : { href: "/registro", label: "Empezar ahora" };

  // Cifras reales de la app (no inventadas).
  const stats = [
    { value: String(MODELS.length), label: "modelos de IA" },
    { value: String(DEFAULT_CATEGORIES.length), label: "categorías de modificadores" },
    { value: String(MODELS[0].ratios.length + 1), label: "proporciones de salida" },
  ];

  return (
    <div className="bg-background">
      {/* HERO */}
      <section id="inicio" className="relative isolate flex min-h-svh flex-col overflow-hidden">
        <div className="absolute inset-y-0 right-0 -z-10 w-full lg:right-[min(22rem,24vw)] lg:w-[64%]">
          <Image
            src="/hero.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 64vw, 100vw"
            className="object-cover object-[85%_center]"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/20 to-transparent max-lg:hidden" />
          <div className="absolute inset-0 bg-gradient-to-b from-background/70 via-transparent to-background lg:from-background/40" />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/60 to-transparent lg:hidden" />
        </div>

        <header className="mx-auto flex w-full max-w-[90rem] items-center justify-between px-4 py-4 lg:px-8">
          <Link href="/" aria-label="Marmo Workshop">
            <Logo priority className="h-11 lg:h-12" />
          </Link>
          <nav className={cn("hidden items-center gap-1 rounded-full p-1 text-sm md:flex", glass)}>
            {NAV.map((n, i) => (
              <a
                key={n.href}
                href={n.href}
                className={cn(
                  "rounded-full px-5 py-2 font-medium transition-colors",
                  i === 0 ? "bg-primary text-primary-foreground" : "text-foreground/80 hover:bg-white/10 hover:text-foreground",
                )}
              >
                {n.label}
              </a>
            ))}
          </nav>
          {user ? (
            <Link href="/studio" className={cn(buttonVariants(), "h-10 rounded-full px-5 text-sm")}>
              Abrir Studio
            </Link>
          ) : (
            <Link href="/login" className={cn(buttonVariants(), "h-10 rounded-full px-5 text-sm")}>
              Iniciar sesión
            </Link>
          )}
        </header>

        <div className="mx-auto flex w-full max-w-[90rem] flex-1 flex-col justify-end gap-8 px-4 pt-40 pb-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end lg:gap-10 lg:px-8 lg:pt-24 lg:pb-10">
          <div className="max-w-2xl">
            <span className={cn("mb-5 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium", glass)}>
              <span className="size-1.5 rounded-full bg-primary" /> Fotografía con IA
            </span>
            <h1 className="text-5xl leading-[1.02] font-medium tracking-tight text-balance sm:text-6xl lg:text-7xl">
              Dirige tus fotos como un{" "}
              <span className="bg-gradient-to-r from-primary to-[oklch(0.78_0.14_35)] bg-clip-text text-transparent">
                director creativo
              </span>
              .
            </h1>
            <p className="mt-5 max-w-lg text-base text-foreground/70 lg:text-lg">
              Elige la luz, la pose, el lente y el outfit. Nosotros hacemos el resto con los mejores modelos de imagen.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a href="#funciones" className={cn(buttonVariants({ variant: "outline" }), "h-12 rounded-full px-6 text-base", glass)}>
                Explorar funciones
              </a>
              <Link href={cta.href} className={cn(buttonVariants(), "h-12 rounded-full px-6 text-base")}>
                {cta.label} <ArrowRight />
              </Link>
            </div>

            <dl className="mt-10 grid max-w-xl grid-cols-3 gap-3">
              {stats.map((s) => (
                <div key={s.label} className={cn("rounded-2xl p-3.5 lg:p-4", glass)}>
                  <dd className="text-3xl font-medium tracking-tight lg:text-4xl">{s.value}</dd>
                  <dt className="mt-1 text-[11px] leading-tight text-foreground/60 lg:text-xs">{s.label}</dt>
                </div>
              ))}
            </dl>
          </div>

          {/* Tarjetas flotantes (escritorio) */}
          <aside className="hidden flex-col gap-4 lg:flex">
            <div className={cn("rounded-3xl p-5", glass)}>
              <p className="text-xs font-medium text-foreground/60">Modificadores</p>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {DEFAULT_CATEGORIES.map((c) => (
                  <li key={c.slug} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                    {c.name}
                  </li>
                ))}
              </ul>
            </div>
            <div className={cn("rounded-3xl p-5", glass)}>
              <p className="text-xs font-medium text-foreground/60">Modelos disponibles</p>
              <p className="mt-1 text-5xl font-medium tracking-tight">{MODELS.length}+</p>
              <p className="mt-1 text-xs text-foreground/60">
                {MODELS.slice(0, 3)
                  .map((m) => m.label)
                  .join(" · ")}
                …
              </p>
              <Link href={cta.href} className={cn(buttonVariants(), "mt-4 h-11 w-full rounded-full")}>
                {cta.label}
              </Link>
            </div>
          </aside>
        </div>

        <p className="mx-auto hidden w-full max-w-[90rem] px-8 pb-10 text-right text-2xl leading-snug font-medium lg:block">
          <span className="ml-auto block max-w-xl text-foreground/90">
            Cada resultado recuerda qué <span className="text-primary">modificadores</span> lo crearon, para que repitas
            lo que <span className="text-primary">funciona</span>.
          </span>
        </p>
      </section>

      {/* FUNCIONES */}
      <section id="funciones" className="mx-auto w-full max-w-[90rem] scroll-mt-6 px-4 py-16 lg:px-8 lg:py-24">
        <p className="text-sm font-medium text-primary">Funciones</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-medium tracking-tight text-balance lg:text-5xl">
          Todo lo que necesitas para dirigir cada toma.
        </h2>
        <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-3xl border bg-card p-6">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/15 text-primary">
                <Icon className="size-5" />
              </div>
              <h3 className="mt-5 text-lg font-medium">{title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* MODELOS */}
      <section id="modelos" className="mx-auto w-full max-w-[90rem] scroll-mt-6 px-4 pb-16 lg:px-8 lg:pb-24">
        <p className="text-sm font-medium text-primary">Modelos</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-medium tracking-tight text-balance lg:text-5xl">
          Elige el modelo que mejor se ajuste a tu idea.
        </h2>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODELS.map((m) => (
            <li key={m.id} className="flex items-center justify-between rounded-2xl border bg-card px-5 py-4">
              <span>
                <span className="block font-medium">{m.label}</span>
                <span className="text-xs text-muted-foreground">{m.provider}</span>
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-xs">{m.kind === "video" ? "Video" : "Imagen"}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* PRECIO */}
      <section id="precio" className="mx-auto w-full max-w-[90rem] scroll-mt-6 px-4 pb-20 lg:px-8 lg:pb-28">
        <p className="text-sm font-medium text-primary">Precio</p>
        <h2 className="mt-2 max-w-2xl text-3xl font-medium tracking-tight text-balance lg:text-5xl">
          Planes simples, en pesos mexicanos.
        </h2>
        <p className="mt-3 max-w-xl text-muted-foreground">
          Pagas un plan mensual que se renueva solo y recibes tokens para crear. Cada generación gasta tokens según el modelo.
          Sin contratos: cancelas cuando quieras.
        </p>
        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:max-w-4xl">
          {plans.map((p) => (
            <div
              key={p.id}
              className={cn(
                "flex flex-col rounded-[2rem] p-7 lg:p-9",
                p.highlighted ? "bg-primary text-primary-foreground" : "border bg-card",
              )}
            >
              <p className={cn("text-sm", p.highlighted ? "opacity-80" : "text-muted-foreground")}>{p.name}</p>
              <p className="mt-1 text-5xl font-medium tracking-tight">
                {formatMxn(p.price_cents)}
                <span className={cn("text-base font-normal", p.highlighted ? "opacity-80" : "text-muted-foreground")}> / mes</span>
              </p>
              <p className={cn("mt-3 text-sm", p.highlighted ? "opacity-90" : "text-muted-foreground")}>{p.description}</p>
              <p className="mt-4 font-medium">
                {formatTokens(p.tokens)} tokens ≈ {Math.floor(p.tokens / nanoTokens)} imágenes
              </p>
              <ul className="mt-5 flex-1 space-y-3 text-sm">
                {p.features.map((t) => (
                  <li key={t} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0" /> {t}
                  </li>
                ))}
              </ul>
              <Link
                href={user ? "/cuenta" : "/registro"}
                className={cn(
                  buttonVariants({ variant: p.highlighted ? "secondary" : "default" }),
                  "mt-8 h-12 w-full rounded-full text-base",
                  p.highlighted && "bg-background text-foreground hover:bg-background/90",
                )}
              >
                {user ? "Elegir plan" : `Empezar con ${p.name}`}
              </Link>
            </div>
          ))}
        </div>
        {packs.length > 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            ¿Prefieres pagar solo lo que uses? Recarga tokens sueltos desde {formatMxn(Math.min(...packs.map((k) => k.price_cents)))}; no caducan.
          </p>
        )}
      </section>

      <footer className="mx-auto flex w-full max-w-[90rem] items-center justify-between border-t px-4 py-8 lg:px-8">
        <Logo className="h-9" />
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Marmo Workshop</p>
      </footer>
    </div>
  );
}
