import type { RegistrationGuard } from './index';

export function createWalletConnectedGuard(
  authenticated: boolean,
  walletAddress: string | undefined
): RegistrationGuard {
  return async () => ({
    id: 'wallet-connected',
    name: 'Wallet Connected',
    allowed: authenticated && !!walletAddress,
    reason:
      !authenticated
        ? 'Please log in to register an agent'
        : !walletAddress
          ? 'No wallet address found'
          : undefined,
    actionLabel: !authenticated ? 'Log In' : undefined,
  });
}
