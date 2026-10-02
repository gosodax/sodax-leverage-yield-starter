import type { IEvmWalletProvider } from '@sodax/types';

/**
 * Wraps a wallet provider so we learn each transaction hash the moment the wallet broadcasts it. `vaultSwap` only
 * resolves after the relay to Sonic, so without this the UI couldn't show the source tx link while it waits.
 * A Proxy (not a spread) so class-based providers keep their prototype methods and private state.
 */
export function withTxListener(provider: IEvmWalletProvider, onSent: (hash: string) => void): IEvmWalletProvider {
  return new Proxy(provider, {
    get(target, prop) {
      if (prop === 'sendTransaction') {
        const send: IEvmWalletProvider['sendTransaction'] = async (tx, options) => {
          const hash = await target.sendTransaction(tx, options);
          onSent(hash);
          return hash;
        };
        return send;
      }
      const value = Reflect.get(target, prop, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
