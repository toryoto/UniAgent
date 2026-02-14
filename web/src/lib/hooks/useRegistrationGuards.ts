'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import {
  evaluateGuards,
  type RegistrationGuardResult,
} from '@/lib/registration/guards';
import { createWalletConnectedGuard } from '@/lib/registration/guards/wallet-connected.guard';
import { createEasAttestationGuard } from '@/lib/registration/guards/eas-attestation.guard';
import { createStakingGuard } from '@/lib/registration/guards/staking.guard';

export function useRegistrationGuards() {
  const { authenticated, user } = usePrivy();
  const walletAddress = user?.wallet?.address;

  const [guards, setGuards] = useState<RegistrationGuardResult[]>([]);
  const [isChecking, setIsChecking] = useState(true);

  const checkGuards = useCallback(async () => {
    setIsChecking(true);
    const results = await evaluateGuards([
      createWalletConnectedGuard(authenticated, walletAddress),
      createEasAttestationGuard(walletAddress),
      createStakingGuard(walletAddress),
    ]);
    setGuards(results);
    setIsChecking(false);
  }, [authenticated, walletAddress]);

  useEffect(() => {
    checkGuards();
  }, [checkGuards]);

  const allPassed = guards.length > 0 && guards.every((g) => g.allowed);

  return { guards, allPassed, isChecking, recheckGuards: checkGuards };
}
