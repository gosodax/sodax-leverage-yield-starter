import { ChainKeys, type SpokeChainKey } from '@sodax/types';
import type { ReactNode } from 'react';
import { chainName, explorerTxUrl } from '@/lib/chains';
import { shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { IntentPhase } from '../hooks/useIntentStatus';
import type { FlowState } from '../hooks/useVaultFlow';
import { ExtLink, ProgressBar } from '../win/controls';
import { Arrow, CheckMark, FizzIcon, Hourglass, KeyIcon, PenIcon, TruckIcon } from '../win/icons';

type RowStatus = 'pending' | 'active' | 'done' | 'skipped' | 'error';

type Row = {
  id: string;
  icon: ReactNode;
  label: string;
  status: RowStatus;
  link?: { chainKey: SpokeChainKey; hash: string };
};

/**
 * The planned steps (before signing) and their live status (after). Each signed step links to its explorer:
 * approve and sign on the source network, delivery and fill on Sonic (or the payout network for a withdraw).
 */
export function FlowSteps({
  kind,
  state,
  phase,
  fillTxHash,
  srcChainKey,
  fillChainKey,
  tokenSymbol,
  approval,
  planned,
}: {
  kind: 'deposit' | 'withdraw';
  state: FlowState;
  phase: IntentPhase;
  fillTxHash: string | undefined;
  srcChainKey: SpokeChainKey;
  /** Where the fill lands: Sonic for a deposit, the payout network for a withdraw. */
  fillChainKey: SpokeChainKey;
  tokenSymbol: string;
  /** 'maybe' before we know the allowance (ERC-20 deposits), 'no' for native tokens and withdrawals. */
  approval: 'maybe' | 'no';
  planned?: boolean;
}) {
  const step = state.step;
  const order = ['idle', 'preparing', 'approving', 'signing', 'submitted', 'done'];
  const at = step === 'error' ? (state.failedAt ?? 'submitted') : step;
  const reached = (s: string) => order.indexOf(at) >= order.indexOf(s);
  const signed = !!state.srcTxHash || reached('submitted');
  const filled = step === 'done' || phase === 'filled';
  const sameChain = srcChainKey === ChainKeys.SONIC_MAINNET && kind === 'deposit';

  const rows: Row[] = [];
  const showApprove = kind === 'deposit' && approval === 'maybe' && state.needsApproval !== false;
  if (showApprove) {
    rows.push({
      id: 'approve',
      icon: <KeyIcon />,
      label:
        state.needsApproval === undefined
          ? `Approve ${tokenSymbol} (only if needed; some tokens ask twice)`
          : `Approve ${tokenSymbol}`,
      status:
        at === 'approving' || at === 'preparing'
          ? planned
            ? 'pending'
            : 'active'
          : reached('signing')
            ? 'done'
            : 'pending',
      link: state.approveTxHash ? { chainKey: srcChainKey, hash: state.approveTxHash } : undefined,
    });
  }
  rows.push({
    id: 'sign',
    icon: <PenIcon />,
    label:
      kind === 'deposit'
        ? `Sign the deposit on ${chainName(srcChainKey)}`
        : `Sign the withdrawal on ${chainName(srcChainKey)}`,
    status:
      at === 'signing' || (!showApprove && at === 'preparing')
        ? signed
          ? 'done'
          : 'active'
        : signed
          ? 'done'
          : 'pending',
    link: state.srcTxHash ? { chainKey: srcChainKey, hash: state.srcTxHash } : undefined,
  });
  if (!sameChain) {
    rows.push({
      id: 'deliver',
      icon: <TruckIcon />,
      label: 'SODAX delivers the order to Sonic',
      status: !signed ? 'pending' : filled || phase === 'filling' || state.dstTxHash ? 'done' : 'active',
      link:
        state.dstTxHash && state.dstTxHash !== state.srcTxHash
          ? { chainKey: ChainKeys.SONIC_MAINNET, hash: state.dstTxHash }
          : undefined,
    });
  }
  rows.push({
    id: 'fill',
    icon: <FizzIcon />,
    label:
      kind === 'deposit'
        ? 'A solver fills it: shares land in your hub wallet'
        : `A solver fills it: ${tokenSymbol} paid out on ${chainName(fillChainKey)}`,
    status: filled ? 'done' : signed && (phase === 'filling' || !!state.dstTxHash) ? 'active' : 'pending',
    link: fillTxHash ? { chainKey: fillChainKey, hash: fillTxHash } : undefined,
  });

  if (step === 'error') {
    const failed =
      rows.find(r => r.status === 'active') ?? rows.find(r => r.status === 'pending') ?? rows[rows.length - 1];
    if (failed) failed.status = 'error';
  }

  const done = rows.filter(r => r.status === 'done').length;

  return (
    <div className="flex flex-col gap-2">
      <ol className="flex flex-col gap-1">
        {rows.map(row => (
          <li key={row.id} className="flex items-center gap-2">
            <span className="flex w-4 justify-center">
              {planned ? (
                <Arrow size={9} />
              ) : row.status === 'done' ? (
                <CheckMark />
              ) : row.status === 'active' ? (
                <Hourglass />
              ) : row.status === 'error' ? (
                <span className="font-bold text-[var(--destructive)]">✕</span>
              ) : (
                <span className="size-[5px] bg-[var(--win-shadow)]" />
              )}
            </span>
            {row.icon}
            <span
              className={cn(
                'flex-1',
                row.status === 'active' && 'font-bold',
                row.status === 'pending' && !planned && 'text-[var(--win-gray-text)]',
              )}
            >
              {row.label}
            </span>
            {row.link && (
              <ExtLink href={explorerTxUrl(row.link.chainKey, row.link.hash)} className="shrink-0">
                {shortenAddress(row.link.hash)}
              </ExtLink>
            )}
          </li>
        ))}
      </ol>
      {!planned && (
        <ProgressBar
          value={(done / rows.length) * 100}
          indeterminate={step !== 'done' && step !== 'error' && rows.some(r => r.status === 'active') && done === 0}
        />
      )}
    </div>
  );
}
