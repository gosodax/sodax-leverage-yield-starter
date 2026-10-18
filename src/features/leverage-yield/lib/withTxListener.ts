import type { IEvmWalletProvider } from '@sodax/types';

/**
 * Wraps a wallet provider so we learn each transaction hash the moment the user signs, instead of only when
 * `vaultSwap` resolves (it waits for the solver fill, which can take a minute or two). Lets the UI show an
 * explorer link and start status polling right away.
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
