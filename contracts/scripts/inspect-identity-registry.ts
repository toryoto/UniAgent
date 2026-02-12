import { ethers } from 'hardhat';

/**
 * AgentIdentityRegistry のオンチェーン状態を確認するユーティリティスクリプト。
 *
 * 使い方:
 *   npx hardhat run scripts/inspect-identity-registry.ts --network base-sepolia
 *
 * アドレスは以下の優先順位で解決されます:
 *   1. 環境変数 AGENT_IDENTITY_REGISTRY_ADDRESS
 *   2. このファイル内のハードコード値
 */

// 必要に応じてここを書き換えるか、.env の AGENT_IDENTITY_REGISTRY_ADDRESS を設定する
const DEFAULT_REGISTRY_ADDRESS = '0x28E0346B623C80Fc425E85339310fe09B79012Cd';

async function main() {
  const REGISTRY_ADDRESS =
    process.env.AGENT_IDENTITY_REGISTRY_ADDRESS || DEFAULT_REGISTRY_ADDRESS;

  console.log('Inspecting AgentIdentityRegistry...');
  console.log('Registry address:', REGISTRY_ADDRESS);

  const [deployer] = await ethers.getSigners();
  console.log('Using account:', deployer.address);

  const Factory = await ethers.getContractFactory('AgentIdentityRegistry');
  const registry = Factory.attach(REGISTRY_ADDRESS);

  const balance = await registry.getFunction('balanceOf')(
    deployer.address,
  );
  console.log('\n=== Balances ===');
  console.log('balanceOf(deployer):', balance.toString());

  const totalSupply = await registry.getFunction('totalSupply')();
  console.log('\n=== Supply ===');
  console.log('totalSupply:', totalSupply.toString());

  const allIds = await registry.getFunction('getAllAgentIds')();
  console.log('\n=== All Agent IDs ===');
  console.log(
    'getAllAgentIds:',
    allIds.map((id: any) => id.toString()),
  );
  console.log('length:', allIds.length);

  console.log('\n=== Tokens Detail ===');
  for (let i = 0; i < allIds.length; i++) {
    const id = allIds[i];
    try {
      const owner = await registry.getFunction('ownerOf')(id);
      const uri = await registry.getFunction('tokenURI')(id);
      console.log(
        `Token ${id.toString()}: owner=${owner}, uri=${uri.substring(
          0,
          80,
        )}...`,
      );
    } catch (e) {
      console.log(`Token ${id.toString()}: failed to fetch details`, e);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

