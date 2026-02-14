/**
 * EAS Agent Evaluation Schema Registration
 *
 * Base Sepolia の SchemaRegistry にエージェント評価用スキーマを登録する。
 * スキーマ登録はオンチェーン1回のみ
 * 以降の attestation 作成はオフチェーン署名で行う想定。
 *
 * Usage:
 *   npx hardhat run scripts/register-eas-agent-evaluation-schema.ts --network base-sepolia
 */

import { ethers } from 'hardhat';
import { SchemaRegistry } from '@ethereum-attestation-service/eas-sdk';

/** Base Sepolia SchemaRegistry (公式 eas-contracts) */
const SCHEMA_REGISTRY_ADDRESS = '0x4200000000000000000000000000000000000020';

/** Base Sepolia EAS contract */
const EAS_CONTRACT_ADDRESS = '0x4200000000000000000000000000000000000021';

/** Resolver なし */
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const SCHEMA =
  'uint256 agentId, bytes32 paymentTx, uint256 chainId, uint8 quality, uint8 reliability, uint32 latency, uint64 timestamp, string[] tags';

async function main() {
  console.log('='.repeat(60));
  console.log('EAS Agent Evaluation Schema Registration');
  console.log('='.repeat(60));

  const [signer] = await ethers.getSigners();
  console.log('Registerer:', signer.address);

  const balance = await ethers.provider.getBalance(signer.address);
  console.log('Balance:', ethers.formatEther(balance), 'ETH');

  if (balance === BigInt(0)) {
    throw new Error('Insufficient balance. Get testnet ETH from the Superchain faucet.');
  }

  const network = await ethers.provider.getNetwork();
  console.log('Network:', network.name, `(chainId: ${network.chainId})`);
  console.log('');

  console.log('Schema:');
  console.log(`  ${SCHEMA}`);
  console.log('Resolver:', ZERO_ADDRESS, '(none)');
  console.log('Revocable:', true);
  console.log('');

  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaRegistry.connect(signer as any);

  console.log('Sending transaction...');

  const transaction = await schemaRegistry.register({
    schema: SCHEMA,
    resolverAddress: ZERO_ADDRESS,
    revocable: true,
  });

  console.log('Waiting for confirmation...');

  const schemaUID = await transaction.wait();

  const txHash = transaction.receipt?.hash ?? '(unknown)';

  console.log('');
  console.log('='.repeat(60));
  console.log('Registration Successful');
  console.log('='.repeat(60));
  console.log('Transaction hash:', txHash);
  console.log('Schema UID:', schemaUID);
  console.log(`View: https://base-sepolia.easscan.org/schema/view/${schemaUID}`);
  console.log('');
  console.log('Next steps:');
  console.log('  1. Save the Schema UID for off-chain attestation creation');
  console.log('  2. Use EAS SDK signOffchainAttestation() with this schema');
  console.log(`  3. EAS contract address: ${EAS_CONTRACT_ADDRESS}`);
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    // AlreadyExists / execution reverted = 同一スキーマが登録済みの可能性
    // RPC は "execution reverted" のみ返し、Solidity の revert reason を含まないことがある
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('execution reverted')) {
      console.error('');
      console.error('The transaction reverted. This usually means the schema is already registered.');
      console.error('The schema UID is deterministic — identical schema strings produce the same UID.');
      console.error('Look up existing schemas: https://base-sepolia.easscan.org/schemas');
      process.exit(0);
    }
    console.error(error);
    process.exit(1);
  });
