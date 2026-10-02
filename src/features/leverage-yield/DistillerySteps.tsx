import { Reveal } from './Reveal';

const STEPS = [
  {
    polish: 'Nalej',
    meaning: 'Pour',
    title: 'Pour in any token',
    text: 'Pay with a supported token from an EVM network. The vault takes it from there.',
    glyph: '💧',
  },
  {
    polish: 'Zapętl',
    meaning: 'Loop',
    title: 'The vault loops it',
    text: 'It borrows against the liquid staking token and re-stakes it, multiplying yield and risk.',
    glyph: '🌀',
  },
  {
    polish: 'Dojrzewaj',
    meaning: 'Mature',
    title: 'Let it mature',
    text: 'Your lsoda* shares stay put while their price moves with the vault. Keep an eye on the health factor.',
    glyph: '🕰️',
  },
  {
    polish: 'Odbierz',
    meaning: 'Collect',
    title: 'Collect when you like',
    text: 'Sell your shares back into a token on a network you choose. Check the minimum before you sign.',
    glyph: '🥂',
  },
] as const;

/** The four-step flow as a row of cards. Each lifts and tilts on hover, and the connecting line fills on scroll. */
export function DistillerySteps() {
  return (
    <section aria-labelledby="steps-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-bold uppercase tracking-wider text-secondary-foreground">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          How it works
        </span>
        <h2 id="steps-heading" className="font-display text-4xl leading-tight">
          Distilled in <span className="font-accent text-primary">four</span> steps
        </h2>
      </div>
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, index) => (
          <li key={step.polish}>
            <Reveal delay={index * 120} className="h-full">
              <div className="step-card group relative flex h-full flex-col gap-3 overflow-hidden rounded-3xl border bg-card p-5 transition-all duration-300 hover:-translate-y-1.5 hover:rotate-[-1deg] hover:border-primary hover:shadow-xl">
                <span
                  aria-hidden
                  className="absolute -right-3 -top-5 font-display text-8xl leading-none text-primary/10 transition-all duration-300 group-hover:-translate-y-1 group-hover:text-primary/20"
                >
                  {index + 1}
                </span>
                <span
                  aria-hidden
                  className="flex size-12 items-center justify-center rounded-full bg-secondary text-2xl transition-transform duration-300 group-hover:scale-110 group-hover:rotate-12"
                >
                  {step.glyph}
                </span>
                <div className="flex items-baseline gap-2">
                  <span className="font-accent text-2xl text-primary">{step.polish}</span>
                  <span className="text-xs uppercase tracking-widest text-subtle-foreground">{step.meaning}</span>
                </div>
                <h3 className="font-semibold">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.text}</p>
                <span
                  aria-hidden
                  className="mt-auto h-1 w-0 rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500 group-hover:w-full"
                />
              </div>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
