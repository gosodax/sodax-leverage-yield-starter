import { useLeverageYieldEffectiveApr } from '@sodax/dapp-kit';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { useVaults } from './helpers';
import { Reveal } from './Reveal';

const AMOUNTS = [100, 500, 1_000, 5_000] as const;
const HORIZONS = [
  { label: '1 month', years: 1 / 12 },
  { label: '1 year', years: 1 },
  { label: '5 years', years: 5 },
] as const;
/** Assumed price of one Soplica miniature, in USD. A joke unit, not a quote. */
const SHOT_USD = 2;
const MAX_GLASSES = 24;
const RAY = 1e27;

function ShotGlass({ index }: { index: number }) {
  return (
    <svg
      viewBox="0 0 24 30"
      className="shot-glass size-7 shrink-0"
      aria-hidden
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <path
        d="M3 3h18l-2 22a3 3 0 0 1-3 2.5H8A3 3 0 0 1 5 25z"
        className="fill-card stroke-primary"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M4.2 13h15.6l-1 12a2.2 2.2 0 0 1-2.2 2H7.4a2.2 2.2 0 0 1-2.2-2z" className="fill-accent" />
    </svg>
  );
}

/**
 * A playful, illustrative yield estimate: pick a vault, an amount and a time, and see the live net APR turned into
 * shots of Soplica. Simple interest on today's rate; the rate moves and leverage cuts both ways.
 */
export function ShotCalculator() {
  const vaults = useVaults();
  const [vaultIndex, setVaultIndex] = useState(0);
  const [amount, setAmount] = useState<number>(1_000);
  const [horizon, setHorizon] = useState(1);

  const vault = vaults[vaultIndex];
  const apr = useLeverageYieldEffectiveApr({ params: { vault: vault?.vault } });
  const netApr = apr.data ? Number(apr.data.effectiveNetAprRay) / RAY : undefined;

  const years = HORIZONS[horizon]?.years ?? 1;
  const earned = netApr === undefined ? undefined : amount * netApr * years;
  const shots = earned === undefined ? 0 : Math.max(0, Math.floor(earned / SHOT_USD));
  const glasses = Math.min(shots, MAX_GLASSES);
  const toast = shots >= 12 ? 'Sto lat!' : shots > 0 ? 'Na zdrowie!' : 'Cierpliwości…';

  return (
    <Reveal>
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-secondary via-secondary/40 to-card">
          <CardTitle className="text-2xl">
            How many <span className="font-accent text-primary">shots</span> is your yield?
          </CardTitle>
          <CardDescription>
            Today's live net APR, poured into Soplica minis at about ${SHOT_USD} a bottle. Just for fun, not a forecast.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <div className="flex flex-col gap-4">
            <Chips label="Vault" options={vaults.map(v => v.name)} active={vaultIndex} onPick={setVaultIndex} />
            <Chips
              label="Deposit (USD value)"
              options={AMOUNTS.map(a => `$${a.toLocaleString('en-US')}`)}
              active={AMOUNTS.indexOf(amount as (typeof AMOUNTS)[number])}
              onPick={i => setAmount(AMOUNTS[i] ?? 1_000)}
            />
            <Chips label="For" options={HORIZONS.map(h => h.label)} active={horizon} onPick={setHorizon} />
          </div>
          <div className="flex flex-col justify-between gap-4 rounded-3xl bg-muted p-5">
            <style>{`
              @media (prefers-reduced-motion: no-preference) {
                .shot-glass { animation: shot-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) both; }
              }
              @keyframes shot-pop { from { transform: translateY(10px) scale(0.4); opacity: 0; } to { transform: none; opacity: 1; } }
            `}</style>
            <div className="flex items-end justify-between gap-3">
              <div className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Illustrative yield
                </span>
                <span
                  className={cn(
                    'font-display text-5xl leading-none tabular-nums',
                    earned !== undefined && earned < 0 ? 'text-destructive' : 'text-success',
                  )}
                >
                  {earned === undefined ? '–' : `${earned < 0 ? '-' : ''}$${Math.abs(earned).toFixed(2)}`}
                </span>
                <span className="mt-1 text-xs text-muted-foreground">
                  at {netApr === undefined ? '–' : `${(netApr * 100).toFixed(2)}%`} net APR
                </span>
              </div>
              <span className="font-accent text-2xl text-primary">{toast}</span>
            </div>
            {/* key restarts the pop-in whenever the answer changes */}
            <div
              key={`${vaultIndex}-${amount}-${horizon}-${glasses}`}
              className="flex min-h-14 flex-wrap items-end gap-1"
              role="img"
              aria-label={`About ${shots} Soplica minis`}
            >
              {Array.from({ length: glasses }, (_, i) => (
                <ShotGlass key={i} index={i} />
              ))}
              {shots > glasses && <span className="pb-1 text-sm font-semibold text-primary">+{shots - glasses}</span>}
              {shots === 0 && <span className="text-sm text-muted-foreground">Not even one mini yet.</span>}
            </div>
            <p className="text-xs text-subtle-foreground">
              Simple interest at the current rate. The rate changes, leverage amplifies losses as well as gains, and a
              vault can lose value.
            </p>
          </div>
        </CardContent>
      </Card>
    </Reveal>
  );
}

function Chips({
  label,
  options,
  active,
  onPick,
}: {
  label: string;
  options: readonly string[];
  active: number;
  onPick: (index: number) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            aria-pressed={index === active}
            onClick={() => onPick(index)}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold transition-all hover:-translate-y-0.5',
              index === active
                ? 'border-primary bg-primary text-primary-foreground shadow-md'
                : 'bg-card text-muted-foreground hover:border-primary hover:text-foreground',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </fieldset>
  );
}
