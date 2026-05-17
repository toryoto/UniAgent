/**
 * Historical script: previously registered Web-hosted dummy agents on AgentRegistry.
 * Those `/api/agents/*` routes were removed; this script no longer registers anything.
 *
 * Usage (no-op):
 * npx hardhat run scripts/register-sample-agents.ts --network base-sepolia
 */

async function main() {
  console.log(
    'register-sample-agents: Web のダミー Agent ルートは削除済みのため、登録処理は行いません。',
  );
  console.log(
    'エージェントは a2a-agents や独自ホストの endpoint をレジストリに登録してください。',
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
