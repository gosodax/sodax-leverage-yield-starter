import { brand } from '@/brand/brand.config';

export function Hero() {
  return (
    <section className="overflow-hidden bg-hero text-hero-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 sm:py-16 md:grid-cols-[1fr_auto] md:items-end">
        <div className="flex flex-col gap-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-hero-accent">Powered by SODAX</p>
          <h1 className="max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
            Earn more from the assets you already hold.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-hero-muted sm:text-lg">{brand.tagline}</p>
        </div>
        <div className="hidden size-28 rounded-full border border-hero-accent/40 p-5 md:block">
          <img src={`${import.meta.env.BASE_URL}brand/logo-on-dark.svg`} alt="" className="size-full" />
        </div>
      </div>
    </section>
  );
}
