/**
 * Wagmi Configuration
 *
 * WagmiとPrivyの統合設定
 */

import { createConfig } from '@privy-io/wagmi';
import { http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(),
  },
});
