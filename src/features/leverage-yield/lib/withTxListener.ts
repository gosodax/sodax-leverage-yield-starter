import type { IEvmWalletProvider } from '@sodax/types';

/**
 * Wraps a wallet provider so we learn each tx hash the moment the user signs, rather than when `vaultSwap`
 * resolves (after the solver fill). Lets the progress dialog show explorer links and start polling right away.
 */
export function withTxListener(walletProvider: IEvmWalletProvider, onTx: (hash: string) => void): IEvmWalletProvider {
  return new Proxy(walletProvider, {
    get(target, prop) {
      if (prop === 'sendTransaction') {
        return async (...args: Parameters<IEvmWalletProvider['sendTransaction']>) => {
          const hash = await target.sendTransaction(...args);
          onTx(hash);
          return hash;
        };
      }
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
