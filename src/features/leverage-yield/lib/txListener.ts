import type { IEvmWalletProvider } from '@sodax/types';

/**
 * Wraps a wallet provider so each transaction hash is known the moment the user signs, not only when the whole
 * vault swap resolves. That lets the wizard link the explorer and start status polling right away.
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
