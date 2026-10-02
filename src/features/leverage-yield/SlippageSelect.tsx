import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MAX_SLIPPAGE_BPS } from '@/config/workshop';
import { formatBps } from '@/lib/format';

/** Slippage options, capped at the workshop's MAX_SLIPPAGE_BPS — users can never go above it. */
const OPTIONS = [50, 100, 200, 300].filter(bps => bps <= MAX_SLIPPAGE_BPS);

export function SlippageSelect({ valueBps, onChange }: { valueBps: number; onChange: (bps: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium">Max slippage</span>
      <Select value={String(valueBps)} onValueChange={value => onChange(Number(value))}>
        <SelectTrigger className="h-9 w-24" aria-label="Max slippage">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {OPTIONS.map(bps => (
            <SelectItem key={bps} value={String(bps)}>
              {formatBps(bps)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
