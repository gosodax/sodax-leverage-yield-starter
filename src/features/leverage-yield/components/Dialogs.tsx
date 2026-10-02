import * as DialogPrimitive from '@radix-ui/react-dialog';
import { SDK_VERSION } from '@sodax/sdk';
import type { ReactNode } from 'react';
import { Btn } from '../win/controls';
import { BottleIcon, CaptionGlyph, CrateIcon, WizardIcon } from '../win/icons';
import { BuiltOn, Flag, Wordmark } from '../win/Logo';

function MessageBox({
  open,
  onOpenChange,
  title,
  children,
  footer,
  width = 'max-w-[460px]',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  footer: ReactNode;
  width?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--win-text)]/10" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={`w2k w2k-window bevel-out fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-16px)] w-[calc(100%-16px)] ${width} -translate-x-1/2 -translate-y-1/2 flex-col outline-none`}
        >
          <div className="w2k-titlebar">
            <Flag className="h-3.5 w-4" />
            <DialogPrimitive.Title className="w2k-titlebar-text text-[11px]">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="w2k-caption-btn bevel-out" aria-label="Close">
              <CaptionGlyph kind="close" />
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 overflow-y-auto">{children}</div>
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-3 pt-1 pb-2.5">{footer}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** "Getting Started with HazyVault2000": the three steps, shown after boot until the user unticks it. */
export function GettingStarted({
  open,
  onOpenChange,
  showAtStartup,
  onShowAtStartup,
  connected,
  onConnect,
  onDeposit,
  onShares,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showAtStartup: boolean;
  onShowAtStartup: (show: boolean) => void;
  connected: boolean;
  onConnect: () => void;
  onDeposit: () => void;
  onShares: () => void;
}) {
  const steps = [
    {
      icon: <WizardIcon size={32} />,
      title: connected ? 'Wallet connected ✓' : 'Connect your wallet',
      text: 'Any EVM browser wallet with a little USDC and gas on Base, Arbitrum or Sonic.',
      action: connected ? undefined : { label: 'Connect…', run: onConnect },
    },
    {
      icon: <BottleIcon size={32} />,
      title: 'Pick a soda and deposit',
      text: 'Each can is a vault: the higher the fizz, the higher its APR; more bubbles, more leverage. About $5 is plenty to try.',
      action: { label: 'Deposit…', run: onDeposit },
    },
    {
      icon: <CrateIcon size={32} />,
      title: 'Track it, then withdraw any time',
      text: 'The wizard links every transaction. Your shares show up in My Shares, ready to withdraw to any token.',
      action: { label: 'My Shares', run: onShares },
    },
  ];
  return (
    <MessageBox
      open={open}
      onOpenChange={onOpenChange}
      title="Getting Started"
      width="max-w-[560px]"
      footer={
        <>
          <label className="mr-auto flex items-center gap-1.5">
            <input
              type="checkbox"
              className="w2k-check"
              checked={showAtStartup}
              onChange={e => onShowAtStartup(e.target.checked)}
            />
            Show this screen at startup
          </label>
          <Btn isDefault onClick={() => onOpenChange(false)}>
            Close
          </Btn>
        </>
      }
    >
      <div className="flex">
        <div className="w2k-wizard-banner hidden w-[120px] shrink-0 flex-col justify-end p-3 sm:flex">
          <p className="text-[var(--win-highlight)]" style={{ fontFamily: 'var(--font-display)' }}>
            <span className="block text-[15px] font-semibold">Getting</span>
            <span className="block text-[15px] font-semibold">Started</span>
          </p>
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1 bg-[var(--win-window)] p-4">
          <Wordmark tone="dark" className="mb-2 scale-90 origin-left" />
          <p className="mb-2">Leveraged staking yield from the network you already use, in three steps:</p>
          <ol className="flex flex-col gap-2">
            {steps.map((step, i) => (
              <li key={step.title} className="flex items-start gap-3">
                <span className="w-4 pt-2 text-right font-bold">{i + 1}.</span>
                {step.icon}
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{step.title}</p>
                  <p className="text-[var(--win-dark)]">{step.text}</p>
                </div>
                {step.action && (
                  <Btn
                    className="mt-1"
                    onClick={() => {
                      onOpenChange(false);
                      step.action?.run();
                    }}
                  >
                    {step.action.label}
                  </Btn>
                )}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </MessageBox>
  );
}

export function AboutBox({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <MessageBox
      open={open}
      onOpenChange={onOpenChange}
      title="About HazyVault2000"
      footer={
        <Btn isDefault onClick={() => onOpenChange(false)}>
          OK
        </Btn>
      }
    >
      <div className="flex flex-col gap-3 p-4">
        <div className="bevel-thin-in flex flex-col items-start gap-1 bg-[var(--win-title-a)] p-4">
          <Wordmark />
          <BuiltOn className="pl-[76px] text-[var(--win-title-b)]" />
        </div>
        <p>
          HazyVault2000 Professional
          <br />
          Version 5.0 (Build 2195: Service Pack Soda)
          <br />
          SODAX SDK {SDK_VERSION}
        </p>
        <div className="etched-h" />
        <p className="leading-snug text-[var(--win-dark)]">
          Pooled leverage-yield vaults on Sonic (ERC-4626 lsoda* shares). SODAX is non-custodial software: it routes and
          settles your order, and independent solvers fill it. Real funds: the APR is variable and can turn negative,
          leverage multiplies losses as well as gains, and vault deposits carry smart-contract and market risk.
        </p>
        <p className="text-[var(--win-dark)]">
          Not affiliated with any operating system vendor. Made with soda by hazy2go.
        </p>
      </div>
    </MessageBox>
  );
}

export function RecycleBin({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <MessageBox
      open={open}
      onOpenChange={onOpenChange}
      title="Recycle Bin"
      footer={
        <Btn isDefault onClick={() => onOpenChange(false)}>
          OK
        </Btn>
      }
    >
      <p className="p-4">The Recycle Bin is empty. Vault shares can't be thrown away: withdraw them instead.</p>
    </MessageBox>
  );
}
