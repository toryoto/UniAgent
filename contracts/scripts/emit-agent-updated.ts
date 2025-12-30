import { ethers } from 'hardhat';

/**
 * AgentUpdated を発火させるための簡易スクリプト
 *
 * 使い方（Base Sepolia例）:
 *   cd contracts
 *   AGENT_REGISTRY_ADDRESS=0x... \
 *   AGENT_ID=0x... \                    # 任意（未指定なら getAllAgentIds()[0] を使用）
 *   NEW_DESCRIPTION="desc" \            # 任意
 *   NEW_IMAGE_URL="https://..." \       # 任意
 *   npx hardhat run scripts/emit-agent-updated.ts --network base-sepolia
 *
 * 注意:
 * - updateAgent は onlyAgentOwner なので「その AgentCard を登録した owner の鍵」で実行する必要があります
 * - payment は receiverAddress=0x0 にすることで「変更しない」扱いになります（コントラクト側条件に合わせる）
 */

async function main() {
  const registryAddress = process.env.AGENT_REGISTRY_ADDRESS;
  if (!registryAddress) {
    throw new Error('AGENT_REGISTRY_ADDRESS is required');
  }

  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();

  const registry = await ethers.getContractAt('AgentRegistry', registryAddress, signer);

  let agentId = process.env.AGENT_ID;
  if (!agentId) {
    const ids: string[] = await registry.getAllAgentIds();
    if (ids.length === 0) {
      throw new Error('No agents found on-chain. Provide AGENT_ID explicitly.');
    }
    agentId = ids[0];
  }

  const newDescription =
    process.env.NEW_DESCRIPTION ?? `Updated by script at ${new Date().toISOString()}`;
  const newImageUrl =
    process.env.NEW_IMAGE_URL ?? `https://picsum.photos/seed/${Date.now()}/640/360`;

  // payment.receiverAddress が 0x0 の場合はコントラクト側で「変更しない」扱いになる
  const payment = {
    tokenAddress: ethers.ZeroAddress,
    receiverAddress: ethers.ZeroAddress,
    pricePerCall: 0,
    chain: '',
  };

  console.log('[emit-agent-updated] signer:', signerAddress);
  console.log('[emit-agent-updated] registry:', registryAddress);
  console.log('[emit-agent-updated] agentId:', agentId);
  console.log('[emit-agent-updated] newDescription:', newDescription);
  console.log('[emit-agent-updated] newImageUrl:', newImageUrl);

  const tx = await registry.updateAgent(
    agentId,
    '', // name: keep
    newDescription, // description: update
    '', // url: keep
    '', // version: keep
    payment, // payment: keep
    newImageUrl // imageUrl: update
  );

  console.log('[emit-agent-updated] tx hash:', tx.hash);
  const receipt = await tx.wait();
  console.log('[emit-agent-updated] mined in block:', receipt?.blockNumber);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
