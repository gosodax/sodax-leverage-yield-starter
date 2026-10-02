import type { IEvmWalletProvider } from '@sodax/types';

/**
 * Reports each transaction hash as soon as the user signs, rather than when `vaultSwap` resolves after the
 * solver fill. The UI can then show the explorer link and start polling status straight away.
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
