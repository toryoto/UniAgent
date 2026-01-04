/**
 * Wagmi Configuration
 */

import { createConfig, http } from 'wagmi';
import { baseSepolia } from 'wagmi/chains';

export const config = createConfig({
  chains: [baseSepolia],
  transports: {
    [baseSepolia.id]: http(`${process.env.NEXT_PUBLIC_RPC_URL}`),
  },
  ssr: true,
});
