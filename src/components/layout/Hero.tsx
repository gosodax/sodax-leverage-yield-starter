import { brand } from '@/brand/brand.config';

/** Primary-surface hero band. Display title in the display font, one accent word in the accent font. */
export function Hero() {
  return (
    <section className="border-b-[3px] border-foreground bg-hero text-hero-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="max-w-4xl font-display text-5xl font-semibold leading-[0.96] sm:text-7xl">
          Leveraged staking yield, <span className="font-accent text-hero-accent">one</span> deposit.
        </h1>
        <p className="max-w-2xl text-lg text-hero-muted">{brand.tagline}</p>
      </div>
    </section>
  );
}
