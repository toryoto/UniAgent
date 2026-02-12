import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AgentIdentityRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('AgentIdentityRegistry', function () {
  let registry: AgentIdentityRegistry;
  let owner: SignerWithAddress;
  let agent1Owner: SignerWithAddress;
  let agent2Owner: SignerWithAddress;
  let user: SignerWithAddress;

  const SAMPLE_URI = 'ipfs://QmSampleHash123456789';
  const SAMPLE_URI_2 = 'ipfs://QmUpdatedHash987654321';

  beforeEach(async function () {
    [owner, agent1Owner, agent2Owner, user] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory('AgentIdentityRegistry');
    registry = await Factory.deploy();
    await registry.waitForDeployment();
  });

  // ============================================================================
  // Registration
  // ============================================================================

  describe('Registration', function () {
    it('should register an agent with URI only', async function () {
      const tx = await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
      const receipt = await tx.wait();

      // Check Registered event
      const event = receipt?.logs.find((log) => {
        try {
          return registry.interface.parseLog({ topics: [...log.topics], data: log.data })?.name === 'Registered';
        } catch { return false; }
      });
      expect(event).to.not.be.undefined;

      // Check tokenURI
      const tokenURI = await registry.tokenURI(1);
      expect(tokenURI).to.equal(SAMPLE_URI);

      // Check owner
      expect(await registry.ownerOf(1)).to.equal(agent1Owner.address);
    });

    it('should register an agent with URI and metadata', async function () {
      const metadata = [
        { metadataKey: 'category', metadataValue: ethers.toUtf8Bytes('travel') },
        { metadataKey: 'version', metadataValue: ethers.toUtf8Bytes('1.0.0') },
      ];

      await registry.connect(agent1Owner)['register(string,(string,bytes)[])'](SAMPLE_URI, metadata);

      // Check metadata
      const categoryValue = await registry.getMetadata(1, 'category');
      expect(ethers.toUtf8String(categoryValue)).to.equal('travel');

      const versionValue = await registry.getMetadata(1, 'version');
      expect(ethers.toUtf8String(versionValue)).to.equal('1.0.0');
    });

    it('should auto-increment token IDs', async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
      await registry.connect(agent2Owner)['register(string)'](SAMPLE_URI_2);

      expect(await registry.ownerOf(1)).to.equal(agent1Owner.address);
      expect(await registry.ownerOf(2)).to.equal(agent2Owner.address);
    });

    it('should reject agentWallet key in metadata during registration', async function () {
      const metadata = [
        { metadataKey: 'agentWallet', metadataValue: ethers.toUtf8Bytes('test') },
      ];

      await expect(
        registry.connect(agent1Owner)['register(string,(string,bytes)[])'](SAMPLE_URI, metadata)
      ).to.be.revertedWith('AgentIdentityRegistry: use setAgentWallet');
    });
  });

  // ============================================================================
  // URI Management
  // ============================================================================

  describe('URI Management', function () {
    beforeEach(async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
    });

    it('should update URI by owner', async function () {
      await registry.connect(agent1Owner).setAgentURI(1, SAMPLE_URI_2);
      expect(await registry.tokenURI(1)).to.equal(SAMPLE_URI_2);
    });

    it('should emit URIUpdated event', async function () {
      await expect(registry.connect(agent1Owner).setAgentURI(1, SAMPLE_URI_2))
        .to.emit(registry, 'URIUpdated')
        .withArgs(1, SAMPLE_URI_2, agent1Owner.address);
    });

    it('should reject URI update by non-owner', async function () {
      await expect(
        registry.connect(user).setAgentURI(1, SAMPLE_URI_2)
      ).to.be.revertedWith('AgentIdentityRegistry: not owner');
    });
  });

  // ============================================================================
  // Metadata
  // ============================================================================

  describe('Metadata', function () {
    beforeEach(async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
    });

    it('should set and get metadata', async function () {
      const value = ethers.toUtf8Bytes('test-value');
      await registry.connect(agent1Owner).setMetadata(1, 'testKey', value);

      const result = await registry.getMetadata(1, 'testKey');
      expect(ethers.toUtf8String(result)).to.equal('test-value');
    });

    it('should emit MetadataSet event', async function () {
      const value = ethers.toUtf8Bytes('test-value');
      await expect(registry.connect(agent1Owner).setMetadata(1, 'testKey', value))
        .to.emit(registry, 'MetadataSet');
    });

    it('should reject metadata update by non-owner', async function () {
      await expect(
        registry.connect(user).setMetadata(1, 'testKey', ethers.toUtf8Bytes('value'))
      ).to.be.revertedWith('AgentIdentityRegistry: not owner');
    });

    it('should reject setting agentWallet via setMetadata', async function () {
      await expect(
        registry.connect(agent1Owner).setMetadata(1, 'agentWallet', ethers.toUtf8Bytes('value'))
      ).to.be.revertedWith('AgentIdentityRegistry: use setAgentWallet');
    });

    it('should return empty bytes for non-existent metadata', async function () {
      const result = await registry.getMetadata(1, 'nonexistent');
      expect(result).to.equal('0x');
    });

    it('should revert getMetadata for non-existent agent', async function () {
      await expect(
        registry.getMetadata(999, 'testKey')
      ).to.be.revertedWith('AgentIdentityRegistry: agent does not exist');
    });
  });

  // ============================================================================
  // Agent Wallet
  // ============================================================================

  describe('Agent Wallet', function () {
    beforeEach(async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
    });

    it('should set agent wallet', async function () {
      await registry.connect(agent1Owner).setAgentWallet(1, user.address);
      expect(await registry.getAgentWallet(1)).to.equal(user.address);
    });

    it('should emit AgentWalletSet event', async function () {
      await expect(registry.connect(agent1Owner).setAgentWallet(1, user.address))
        .to.emit(registry, 'AgentWalletSet')
        .withArgs(1, user.address);
    });

    it('should reject zero address wallet', async function () {
      await expect(
        registry.connect(agent1Owner).setAgentWallet(1, ethers.ZeroAddress)
      ).to.be.revertedWith('AgentIdentityRegistry: invalid wallet');
    });

    it('should reject wallet set by non-owner', async function () {
      await expect(
        registry.connect(user).setAgentWallet(1, user.address)
      ).to.be.revertedWith('AgentIdentityRegistry: not owner');
    });

    it('should unset agent wallet', async function () {
      await registry.connect(agent1Owner).setAgentWallet(1, user.address);
      await registry.connect(agent1Owner).unsetAgentWallet(1);
      expect(await registry.getAgentWallet(1)).to.equal(ethers.ZeroAddress);
    });

    it('should emit AgentWalletUnset event', async function () {
      await registry.connect(agent1Owner).setAgentWallet(1, user.address);
      await expect(registry.connect(agent1Owner).unsetAgentWallet(1))
        .to.emit(registry, 'AgentWalletUnset')
        .withArgs(1);
    });

    it('should return zero address for agent without wallet', async function () {
      expect(await registry.getAgentWallet(1)).to.equal(ethers.ZeroAddress);
    });

    it('should revert getAgentWallet for non-existent agent', async function () {
      await expect(
        registry.getAgentWallet(999)
      ).to.be.revertedWith('AgentIdentityRegistry: agent does not exist');
    });
  });

  // ============================================================================
  // Enumeration
  // ============================================================================

  describe('Enumeration', function () {
    it('should track total supply', async function () {
      expect(await registry.totalSupply()).to.equal(0);

      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
      expect(await registry.totalSupply()).to.equal(1);

      await registry.connect(agent2Owner)['register(string)'](SAMPLE_URI_2);
      expect(await registry.totalSupply()).to.equal(2);
    });

    it('should return all agent IDs', async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
      await registry.connect(agent2Owner)['register(string)'](SAMPLE_URI_2);

      const allIds = await registry.getAllAgentIds();
      expect(allIds.length).to.equal(2);
      expect(allIds[0]).to.equal(1);
      expect(allIds[1]).to.equal(2);
    });

    it('should get agent ID at index', async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
      await registry.connect(agent2Owner)['register(string)'](SAMPLE_URI_2);

      expect(await registry.agentIdAtIndex(0)).to.equal(1);
      expect(await registry.agentIdAtIndex(1)).to.equal(2);
    });

    it('should revert for out of bounds index', async function () {
      await expect(
        registry.agentIdAtIndex(0)
      ).to.be.revertedWith('AgentIdentityRegistry: index out of bounds');
    });
  });

  // ============================================================================
  // ERC-721 Behavior
  // ============================================================================

  describe('ERC-721 Behavior', function () {
    beforeEach(async function () {
      await registry.connect(agent1Owner)['register(string)'](SAMPLE_URI);
    });

    it('should support ERC-721 transfer', async function () {
      await registry.connect(agent1Owner).transferFrom(agent1Owner.address, agent2Owner.address, 1);
      expect(await registry.ownerOf(1)).to.equal(agent2Owner.address);
    });

    it('should allow new owner to update URI after transfer', async function () {
      await registry.connect(agent1Owner).transferFrom(agent1Owner.address, agent2Owner.address, 1);
      await registry.connect(agent2Owner).setAgentURI(1, SAMPLE_URI_2);
      expect(await registry.tokenURI(1)).to.equal(SAMPLE_URI_2);
    });

    it('should have correct name and symbol', async function () {
      expect(await registry.name()).to.equal('UniAgent Registry');
      expect(await registry.symbol()).to.equal('UNIAGENT');
    });

    it('should return correct balanceOf', async function () {
      expect(await registry.balanceOf(agent1Owner.address)).to.equal(1);
      expect(await registry.balanceOf(agent2Owner.address)).to.equal(0);

      await registry.connect(agent2Owner)['register(string)'](SAMPLE_URI_2);
      expect(await registry.balanceOf(agent2Owner.address)).to.equal(1);
    });
  });
});
