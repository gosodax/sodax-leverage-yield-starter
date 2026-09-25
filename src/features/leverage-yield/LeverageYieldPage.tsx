import { NextPrompt } from '@/components/workshop/NextPrompt';
import { DepositForm } from './components/DepositForm';

/** Leverage Yield: deposit into pooled lsoda* ERC-4626 vaults via SODAX intents. */
export function LeverageYieldPage() {
  return (
    <div className="flex flex-col gap-8">
      <NextPrompt next={2} />
      <div className="mx-auto w-full max-w-xl">
        <DepositForm />
      </div>
    </div>
  );
}
