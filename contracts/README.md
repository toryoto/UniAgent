# `contracts` — Smart Contracts

Hardhat workspace for UniAgent's on-chain layer on Base Sepolia (Chain ID 84532): agent identity, staking, and deploy/registration scripts.

## Deployed Contracts

| Contract                | Address                                                                                                                         | Notes                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `AgentIdentityRegistry` | [`0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92`](https://sepolia.basescan.org/address/0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92) | [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004), ERC-721-based agent identity; tokenURI → IPFS metadata |
| `AgentStaking`          | [`0xC034e56EDe7FC31579E41095A4e963D499e85d39`](https://sepolia.basescan.org/address/0xC034e56EDe7FC31579E41095A4e963D499e85d39) | USDC staking; feeds the deposit term of agent ranking                                                       |
| `USDC`                  | [`0x036CbD53842c5426634e7929541eC2318f3dCF7e`](https://sepolia.basescan.org/address/0x036CbD53842c5426634e7929541eC2318f3dCF7e) | [EIP-3009](https://eips.ethereum.org/EIPS/eip-3009) token used by x402                                      |

**EAS agent-evaluation schema** (off-chain attestations): UID [`0xfc26...0748`](https://base-sepolia.easscan.org/schema/view/0xfc26bef12f3b12b03dce76761bf0c23ae5ee4370f86132b2d69369cdfd208748)
`uint256 agentId, bytes32 paymentTx, uint256 chainId, uint8 quality, uint8 reliability, uint32 latency, uint64 timestamp, string[] tags`

## Setup

```bash
# From the repository ROOT (never npm install inside contracts/)
npm install

cp contracts/.env.example contracts/.env
# PRIVATE_KEY (deploy/sign), BASE_SEPOLIA_RPC_URL (defaults to https://sepolia.base.org),
# PINATA_JWT / PINATA_GATEWAY_URL for ERC-8004 registration
```

## Commands

```bash
npm run compile            --workspace=contracts
npm run test               --workspace=contracts
npm run deploy:base-sepolia --workspace=contracts
```

### Scripts

Run with `npx hardhat run scripts/<name>.ts --network base-sepolia` from `contracts/`.

| Script                                    | Purpose                                                       |
| ----------------------------------------- | ------------------------------------------------------------- |
| `deploy-identity-registry.ts`             | Deploy `AgentIdentityRegistry`                                |
| `deploy-staking.ts`                       | Deploy `AgentStaking` (constructor pins the registry address) |
| `register-agents-erc8004.ts`              | Register sample ERC-8004 agents (IPFS upload + mint)          |
| `inspect-identity-registry.ts`            | Inspect on-chain registry state                               |
| `register-eas-agent-evaluation-schema.ts` | Register the EAS evaluation schema (one-time)                 |
| `update-agent-urls.ts`                    | Update registered agent URLs                                  |

Redeployment procedure: [REDEPLOYMENT.md](REDEPLOYMENT.md) and [docs/contract-redeploy-runbook.md](../docs/contract-redeploy-runbook.md).
