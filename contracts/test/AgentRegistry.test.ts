import { expect } from 'chai';
import { ethers } from 'hardhat';
import { AgentRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('AgentRegistry', function () {
  let agentRegistry: AgentRegistry;
  let owner: SignerWithAddress;
  let agent1Owner: SignerWithAddress;
  let agent2Owner: SignerWithAddress;
  let user: SignerWithAddress;

  // Sample agent data
  const USDC_ADDRESS = '0x7F594ABa4E1B6e137606a8fBAb5387B90C8DEEa9';
  const agent1Id = ethers.id('TestAgent1');
  const agent2Id = ethers.id('TestAgent2');

  beforeEach(async function () {
    // Get signers
    [owner, agent1Owner, agent2Owner, user] = await ethers.getSigners();

    // Deploy AgentRegistry
    const AgentRegistry = await ethers.getContractFactory('AgentRegistry');
    agentRegistry = await AgentRegistry.deploy();
    await agentRegistry.waitForDeployment();
  });

  describe('Agent Registration', function () {
    it('Should register a new agent', async function () {
      const skills = [
        { id: 'skill1', name: 'Skill 1', description: 'Description 1' },
        { id: 'skill2', name: 'Skill 2', description: 'Description 2' },
      ];

      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      await expect(
        agentRegistry
          .connect(agent1Owner)
          .registerAgent(
            agent1Id,
            'TestAgent1',
            'Test agent description',
            'https://test-agent.example.com',
            '1.0.0',
            ['text/plain'],
            ['application/json'],
            skills,
            payment,
            'test',
            'https://example.com/images/test-agent.png'
          )
      )
        .to.emit(agentRegistry, 'AgentRegistered')
        .withArgs(agent1Id, 'TestAgent1', agent1Owner.address, 'test');

      // Verify agent was registered
      const agent = await agentRegistry.getAgentCard(agent1Id);
      expect(agent.name).to.equal('TestAgent1');
      expect(agent.owner).to.equal(agent1Owner.address);
      expect(agent.isActive).to.equal(true);
      expect(agent.category).to.equal('test');
    });

    it('Should fail to register agent with existing ID', async function () {
      const skills: any[] = [];
      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      // Register first agent
      await agentRegistry
        .connect(agent1Owner)
        .registerAgent(
          agent1Id,
          'TestAgent1',
          'Description',
          'https://test.com',
          '1.0.0',
          ['text/plain'],
          ['application/json'],
          skills,
          payment,
          'test',
          ''
        );

      // Try to register with same ID
      await expect(
        agentRegistry
          .connect(agent2Owner)
          .registerAgent(
            agent1Id,
            'TestAgent2',
            'Description',
            'https://test2.com',
            '1.0.0',
            ['text/plain'],
            ['application/json'],
            skills,
            payment,
            'test',
            ''
          )
      ).to.be.revertedWith('AgentRegistry: agent already exists');
    });

    it('Should fail to register agent with empty name', async function () {
      const skills: any[] = [];
      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      await expect(
        agentRegistry
          .connect(agent1Owner)
          .registerAgent(
            agent1Id,
            '',
            'Description',
            'https://test.com',
            '1.0.0',
            ['text/plain'],
            ['application/json'],
            skills,
            payment,
            'test',
            ''
          )
      ).to.be.revertedWith('AgentRegistry: name required');
    });
  });

  describe('Agent Management', function () {
    beforeEach(async function () {
      const skills: any[] = [];
      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      await agentRegistry
        .connect(agent1Owner)
        .registerAgent(
          agent1Id,
          'TestAgent1',
          'Description',
          'https://test.com',
          '1.0.0',
          ['text/plain'],
          ['application/json'],
          skills,
          payment,
          'test',
          ''
        );
    });

    it('Should update agent information (owner only)', async function () {
      const newPayment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.02', 6),
        chain: 'base-sepolia',
      };

      await expect(
        agentRegistry
          .connect(agent1Owner)
          .updateAgent(
            agent1Id,
            'UpdatedAgent1',
            'Updated description',
            'https://updated.com',
            '2.0.0',
            newPayment,
            'https://example.com/images/updated.png'
          )
      )
        .to.emit(agentRegistry, 'AgentUpdated')
        .withArgs(agent1Id, agent1Owner.address);

      const agent = await agentRegistry.getAgentCard(agent1Id);
      expect(agent.name).to.equal('UpdatedAgent1');
      expect(agent.description).to.equal('Updated description');
      expect(agent.url).to.equal('https://updated.com');
      expect(agent.version).to.equal('2.0.0');
    });

    it('Should fail to update agent by non-owner', async function () {
      const emptyPayment = {
        tokenAddress: ethers.ZeroAddress,
        receiverAddress: ethers.ZeroAddress,
        pricePerCall: 0,
        chain: '',
      };

      await expect(
        agentRegistry.connect(user).updateAgent(agent1Id, 'Hacked', '', '', '', emptyPayment, '')
      ).to.be.revertedWith('AgentRegistry: not owner');
    });

    it('Should deactivate agent (owner only)', async function () {
      await expect(agentRegistry.connect(agent1Owner).deactivateAgent(agent1Id))
        .to.emit(agentRegistry, 'AgentDeactivated')
        .withArgs(agent1Id, agent1Owner.address);

      const agent = await agentRegistry.getAgentCard(agent1Id);
      expect(agent.isActive).to.equal(false);
    });

    it('Should activate agent (owner only)', async function () {
      // First deactivate
      await agentRegistry.connect(agent1Owner).deactivateAgent(agent1Id);

      // Then activate
      await expect(agentRegistry.connect(agent1Owner).activateAgent(agent1Id))
        .to.emit(agentRegistry, 'AgentActivated')
        .withArgs(agent1Id, agent1Owner.address);

      const agent = await agentRegistry.getAgentCard(agent1Id);
      expect(agent.isActive).to.equal(true);
    });
  });

  describe('Transaction Recording', function () {
    beforeEach(async function () {
      const skills: any[] = [];
      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      await agentRegistry
        .connect(agent1Owner)
        .registerAgent(
          agent1Id,
          'TestAgent1',
          'Description',
          'https://test.com',
          '1.0.0',
          ['text/plain'],
          ['application/json'],
          skills,
          payment,
          'test',
          ''
        );
    });

    it('Should record a transaction', async function () {
      const txId = ethers.id('tx1');
      const amount = ethers.parseUnits('0.01', 6);

      await expect(agentRegistry.connect(user).recordTransaction(txId, agent1Id, amount))
        .to.emit(agentRegistry, 'TransactionRecorded')
        .withArgs(txId, agent1Id, user.address, 0, amount);

      const tx = await agentRegistry.getTransaction(txId);
      expect(tx.agentId).to.equal(agent1Id);
      expect(tx.caller).to.equal(user.address);
      expect(tx.rating).to.equal(0);
      expect(tx.amount).to.equal(amount);
    });

    it('Should update transaction rating', async function () {
      const txId = ethers.id('tx1');
      const amount = ethers.parseUnits('0.01', 6);

      // Record transaction
      await agentRegistry.connect(user).recordTransaction(txId, agent1Id, amount);

      // Update rating
      await expect(agentRegistry.connect(user).updateTransactionRating(txId, 5)).to.emit(
        agentRegistry,
        'RatingUpdated'
      );

      const tx = await agentRegistry.getTransaction(txId);
      expect(tx.rating).to.equal(5);

      // Check agent rating
      const agent = await agentRegistry.getAgentCard(agent1Id);
      expect(agent.totalRatings).to.equal(5);
      expect(agent.ratingCount).to.equal(1);
    });

    it('Should fail to update rating by non-caller', async function () {
      const txId = ethers.id('tx1');
      const amount = ethers.parseUnits('0.01', 6);

      await agentRegistry.connect(user).recordTransaction(txId, agent1Id, amount);

      await expect(
        agentRegistry.connect(agent1Owner).updateTransactionRating(txId, 5)
      ).to.be.revertedWith('AgentRegistry: only caller can update rating');
    });

    it('Should fail to update rating with invalid value', async function () {
      const txId = ethers.id('tx1');
      const amount = ethers.parseUnits('0.01', 6);

      await agentRegistry.connect(user).recordTransaction(txId, agent1Id, amount);

      await expect(agentRegistry.connect(user).updateTransactionRating(txId, 0)).to.be.revertedWith(
        'AgentRegistry: rating must be 1-5'
      );

      await expect(agentRegistry.connect(user).updateTransactionRating(txId, 6)).to.be.revertedWith(
        'AgentRegistry: rating must be 1-5'
      );
    });
  });

  describe('Rating System', function () {
    beforeEach(async function () {
      const skills: any[] = [];
      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      await agentRegistry
        .connect(agent1Owner)
        .registerAgent(
          agent1Id,
          'TestAgent1',
          'Description',
          'https://test.com',
          '1.0.0',
          ['text/plain'],
          ['application/json'],
          skills,
          payment,
          'test',
          ''
        );
    });

    it('Should calculate average rating correctly', async function () {
      const amount = ethers.parseUnits('0.01', 6);

      // Record 3 transactions with different ratings
      const tx1Id = ethers.id('tx1');
      const tx2Id = ethers.id('tx2');
      const tx3Id = ethers.id('tx3');

      await agentRegistry.connect(user).recordTransaction(tx1Id, agent1Id, amount);
      await agentRegistry.connect(user).updateTransactionRating(tx1Id, 5);

      await agentRegistry.connect(user).recordTransaction(tx2Id, agent1Id, amount);
      await agentRegistry.connect(user).updateTransactionRating(tx2Id, 4);

      await agentRegistry.connect(user).recordTransaction(tx3Id, agent1Id, amount);
      await agentRegistry.connect(user).updateTransactionRating(tx3Id, 3);

      const agent = await agentRegistry.getAgentCard(agent1Id);
      expect(agent.totalRatings).to.equal(12); // 5 + 4 + 3
      expect(agent.ratingCount).to.equal(3);

      const avgRating = await agentRegistry.getAverageRating(agent1Id);
      expect(avgRating).to.equal(400); // 4.00 * 100
    });
  });

  describe('Search and Discovery', function () {
    beforeEach(async function () {
      const skills: any[] = [];
      const payment = {
        tokenAddress: USDC_ADDRESS,
        receiverAddress: agent1Owner.address,
        pricePerCall: ethers.parseUnits('0.01', 6),
        chain: 'base-sepolia',
      };

      // Register multiple agents
      await agentRegistry
        .connect(agent1Owner)
        .registerAgent(
          agent1Id,
          'TravelAgent1',
          'Description',
          'https://test1.com',
          '1.0.0',
          ['text/plain'],
          ['application/json'],
          skills,
          payment,
          'travel',
          ''
        );

      await agentRegistry
        .connect(agent2Owner)
        .registerAgent(
          agent2Id,
          'TravelAgent2',
          'Description',
          'https://test2.com',
          '1.0.0',
          ['text/plain'],
          ['application/json'],
          skills,
          payment,
          'travel',
          ''
        );
    });

    it('Should get all agent IDs', async function () {
      const allAgentIds = await agentRegistry.getAllAgentIds();
      expect(allAgentIds.length).to.equal(2);
      expect(allAgentIds).to.include(agent1Id);
      expect(allAgentIds).to.include(agent2Id);
    });

    it('Should get agents by category', async function () {
      const travelAgents = await agentRegistry.getAgentsByCategory('travel');
      expect(travelAgents.length).to.equal(2);
    });

    it('Should get active agents by category', async function () {
      // Deactivate one agent
      await agentRegistry.connect(agent1Owner).deactivateAgent(agent1Id);

      const activeAgents = await agentRegistry.getActiveAgentsByCategory('travel');
      expect(activeAgents.length).to.equal(1);
      expect(activeAgents[0]).to.equal(agent2Id);
    });

    it('Should get total counts', async function () {
      const totalAgents = await agentRegistry.getTotalAgentCount();
      expect(totalAgents).to.equal(2);

      const totalTxs = await agentRegistry.getTotalTransactionCount();
      expect(totalTxs).to.equal(0);

      // Record a transaction
      const txId = ethers.id('tx1');
      await agentRegistry
        .connect(user)
        .recordTransaction(txId, agent1Id, ethers.parseUnits('0.01', 6));

      const newTotalTxs = await agentRegistry.getTotalTransactionCount();
      expect(newTotalTxs).to.equal(1);
    });
  });
});
