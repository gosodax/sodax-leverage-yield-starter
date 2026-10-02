import { useDepositQuote } from '../hooks/useDepositQuote';
import { useVaultDeposit } from '../hooks/useVaultDeposit';
import { useVaultWithdraw } from '../hooks/useVaultWithdraw';
import { useWithdrawQuote } from '../hooks/useWithdrawQuote';
import { useTransport } from './transport';
import { useApiVaultDeposit, useApiVaultWithdraw } from './useApiFlows';
import { useApiDepositQuote, useApiWithdrawQuote } from './useApiQuotes';

/** Quotes and flows that follow the SDK/API toggle. The inactive quote gets no amount, so it stays idle. */

export function useDepositQuoteFor(args: Parameters<typeof useDepositQuote>[0]) {
  const transport = useTransport();
  const sdk = useDepositQuote(transport === 'sdk' ? args : { ...args, inputAmount: undefined });
  const api = useApiDepositQuote(transport === 'api' ? args : { ...args, inputAmount: undefined });
  return transport === 'api' ? api : sdk;
}

/** `srcChainKey` is only used by the API quote; the SDK quote reads the shares from Sonic. */
export function useWithdrawQuoteFor(args: Parameters<typeof useApiWithdrawQuote>[0]) {
  const transport = useTransport();
  const sdk = useWithdrawQuote(transport === 'sdk' ? args : { ...args, shares: undefined });
  const api = useApiWithdrawQuote(transport === 'api' ? args : { ...args, shares: undefined });
  return transport === 'api' ? api : sdk;
}

export function useDepositFlow() {
  const transport = useTransport();
  const sdk = useVaultDeposit();
  const api = useApiVaultDeposit();
  return transport === 'api' ? api : sdk;
}

export function useWithdrawFlow() {
  const transport = useTransport();
  const sdk = useVaultWithdraw();
  const api = useApiVaultWithdraw();
  return transport === 'api' ? api : sdk;
}
