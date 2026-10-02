import { WalletIcon } from '@phosphor-icons/react';
import { Button, type ButtonProps } from '@/components/ui/button';
import { AccountMenu } from './AccountMenu';
import { useEvmWallet } from './useEvmWallet';

/** "Connect wallet" when disconnected, the account menu when connected. */
export function ConnectButton(props: Omit<ButtonProps, 'onClick'>) {
  const { isConnected, connect } = useEvmWallet();
  if (isConnected) return <AccountMenu />;
  return (
    <Button onClick={connect} {...props}>
      <WalletIcon weight="duotone" />
      Connect wallet
    </Button>
  );
}
