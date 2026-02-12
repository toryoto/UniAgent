import { ethers } from 'hardhat';

/**
 * AgentIdentityRegistry (ERC-8004) の全エージェントに対して
 * setAgentURI を同じ metadataUrl で呼び出し、URIUpdated イベントを発火させる
 *
 * 用途: Alchemy Webhook のテスト / DB 再同期トリガー
 *
 * Usage:
 *   npx hardhat run scripts/update-agent-urls.ts --network base-sepolia
 *
 * Env (optional):
 *   AGENT_IDENTITY_REGISTRY_ADDRESS  — デフォルト:     '0x28E0346B623C80Fc425E85339310fe09B79012Cd';
 *   AGENT_IDS                        — カンマ区切りで特定の tokenId だけ対象にする (例: "1,2,3")
 */

async function main() {
  const REGISTRY_ADDRESS =
    process.env.AGENT_IDENTITY_REGISTRY_ADDRESS ||
    '0x28E0346B623C80Fc425E85339310fe09B79012Cd';

  const [signer] = await ethers.getSigners();

  console.log('='.repeat(60));
  console.log('Re-emit URIUpdated events (AgentIdentityRegistry)');
  console.log('='.repeat(60));
  console.log('Registry :', REGISTRY_ADDRESS);
  console.log('Signer   :', signer.address);
  console.log();

  const registry = await ethers.getContractAt(
    'AgentIdentityRegistry',
    REGISTRY_ADDRESS,
    signer,
  );

  // 対象 tokenId の決定
  let agentIds: bigint[];

  if (process.env.AGENT_IDS) {
    agentIds = process.env.AGENT_IDS.split(',').map((id) => BigInt(id.trim()));
    console.log(`Targeting ${agentIds.length} agent(s) from AGENT_IDS env`);
  } else {
    agentIds = (await registry.getAllAgentIds()) as bigint[];
    console.log(`Found ${agentIds.length} agent(s) on-chain`);
  }

  if (agentIds.length === 0) {
    console.log('No agents to process. Exiting.');
    return;
  }

  console.log();

  let successCount = 0;
  const errors: Array<{ agentId: string; error: string }> = [];

  for (const agentId of agentIds) {
    const id = agentId.toString();
    try {
      // 現在の tokenURI を取得
      const currentURI: string = await registry.tokenURI(agentId);
      console.log(`[${id}] Current URI: ${currentURI}`);

      // 同じ URI で setAgentURI を呼び出し → URIUpdated イベント発火
      const tx = await registry.setAgentURI(agentId, currentURI);
      console.log(`[${id}] Tx sent: ${tx.hash}`);

      const receipt = await tx.wait();
      console.log(`[${id}] Confirmed in block ${receipt?.blockNumber} (gas: ${receipt?.gasUsed})`);
      successCount++;
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      if (msg.includes('not owner')) {
        console.log(`[${id}] Skipped: not owner`);
      } else if (msg.includes('does not exist') || msg.includes('ERC721NonexistentToken')) {
        console.log(`[${id}] Skipped: token does not exist`);
      } else {
        console.error(`[${id}] Error:`, msg);
      }
      errors.push({ agentId: id, error: msg });
    }
    console.log();
  }

  // サマリー
  console.log('='.repeat(60));
  console.log('Summary');
  console.log('='.repeat(60));
  console.log(`Total agents : ${agentIds.length}`);
  console.log(`Success      : ${successCount}`);
  console.log(`Errors/Skips : ${errors.length}`);
  if (errors.length > 0) {
    for (const { agentId, error } of errors) {
      console.log(`  [${agentId}] ${error.slice(0, 120)}`);
    }
  }
  console.log('='.repeat(60));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
