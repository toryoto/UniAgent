'use client';

import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  useWriteContract,
  useWaitForTransactionReceipt,
  useConnection,
} from 'wagmi';
import { decodeEventLog, type Hex } from 'viem';
import {
  AGENT_IDENTITY_REGISTRY_ABI,
  CONTRACT_ADDRESSES,
} from '@agent-marketplace/shared';
import type { ERC8004Service } from '@agent-marketplace/shared';

export interface RegistrationFormData {
  name: string;
  description: string;
  image: string;
  category: string;
  x402Support: boolean;
  services: ERC8004Service[];
  agentWallet: string;
}

const initialFormData: RegistrationFormData = {
  name: '',
  description: '',
  image: '',
  category: '',
  x402Support: false,
  services: [{ name: '', endpoint: '' }],
  agentWallet: '',
};

const abi = AGENT_IDENTITY_REGISTRY_ABI as readonly Record<string, unknown>[];
const contractAddress = CONTRACT_ADDRESSES.AGENT_IDENTITY_REGISTRY as Hex;

export function useAgentRegistration() {
  const { address } = useConnection();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<RegistrationFormData>(initialFormData);
  const [ipfsUri, setIpfsUri] = useState<string | null>(null);
  const [agentId, setAgentId] = useState<bigint | null>(null);

  // Step 2: IPFS upload
  const uploadMutation = useMutation({
    mutationFn: async (data: RegistrationFormData) => {
      const res = await fetch('/api/agents/register/upload-metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          image: data.image,
          services: data.services.filter((s) => s.name && s.endpoint),
          x402Support: data.x402Support,
          category: data.category || undefined,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Upload failed');
      }
      const result = await res.json();
      return result.ipfsUri as string;
    },
    onSuccess: (uri) => {
      setIpfsUri(uri);
      setCurrentStep(3);
    },
  });

  // Step 3: On-chain register
  const {
    mutateAsync: writeRegister,
    isPending: isRegistering,
    data: registerTxHash,
    error: registerError,
    reset: resetRegister,
  } = useWriteContract();

  const registerReceipt = useWaitForTransactionReceipt({
    hash: registerTxHash,
  });

  // Extract agentId from Registered event when receipt arrives
  if (registerReceipt.data && !agentId) {
    for (const log of registerReceipt.data.logs) {
      try {
        const decoded = decodeEventLog({
          abi: abi,
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === 'Registered') {
          const args = decoded.args as { agentId: bigint };
          setAgentId(args.agentId);
          setCurrentStep(4);
          break;
        }
      } catch {
        // Not the event we're looking for
      }
    }
  }

  // Step 4: Set agent wallet
  const {
    mutateAsync: writeSetWallet,
    isPending: isSettingWallet,
    data: walletTxHash,
    error: walletError,
    reset: resetWallet,
  } = useWriteContract();

  const walletReceipt = useWaitForTransactionReceipt({
    hash: walletTxHash,
  });

  const updateFormData = useCallback(
    (partial: Partial<RegistrationFormData>) => {
      setFormData((prev) => ({ ...prev, ...partial }));
    },
    []
  );

  const uploadToIpfs = useCallback(async () => {
    await uploadMutation.mutateAsync(formData);
  }, [formData, uploadMutation]);

  const registerOnChain = useCallback(async () => {
    if (!ipfsUri) return;
    await writeRegister({
      address: contractAddress,
      abi,
      functionName: 'register',
      args: [ipfsUri],
    });
  }, [ipfsUri, writeRegister]);

  const setAgentWalletOnChain = useCallback(
    async (walletAddress: string) => {
      if (!agentId) return;
      await writeSetWallet({
        address: contractAddress,
        abi,
        functionName: 'setAgentWallet',
        args: [agentId, walletAddress as Hex],
      });
    },
    [agentId, writeSetWallet]
  );

  const reset = useCallback(() => {
    setFormData(initialFormData);
    setCurrentStep(1);
    setIpfsUri(null);
    setAgentId(null);
    uploadMutation.reset();
    resetRegister();
    resetWallet();
  }, [uploadMutation, resetRegister, resetWallet]);

  return {
    // Form
    formData,
    updateFormData,
    currentStep,
    setCurrentStep,

    // Step 2: IPFS
    uploadToIpfs,
    ipfsUri,
    isUploading: uploadMutation.isPending,
    uploadError: uploadMutation.error?.message ?? null,

    // Step 3: Register
    registerOnChain,
    registerTxHash,
    agentId,
    isRegistering,
    isRegisterConfirming: registerReceipt.isLoading,
    registerError: registerError?.message ?? null,

    // Step 4: Wallet
    setAgentWalletOnChain,
    walletTxHash,
    isSettingWallet,
    isWalletConfirming: walletReceipt.isLoading,
    walletError: walletError?.message ?? null,
    walletConfirmed: walletReceipt.isSuccess,

    // Overall
    address,
    reset,
  };
}
