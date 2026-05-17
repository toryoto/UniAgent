---
name: uniagent-cast
description: |
  Foundry cast CLI skill for reading and debugging UniAgent smart contracts on Base Sepolia and Base mainnet.

  Use this skill proactively whenever the user wants to inspect on-chain state for the UniAgent project. Trigger on any of these:
  - "コントラクトを調べて", "残高確認", "イベントログ見て", "トランザクション確認", "tx 見て", "確認して"
  - Any 0x address or tx hash pasted in context with a question about what it does or what it contains
  - Questions about AgentRegistry, AgentIdentityRegistry, USDC on Base chains
  - Checking if a contract is deployed, what functions it has, or who owns it
  - Decoding calldata, ABI output, function selectors, or event topics
  - After a deployment or transaction to verify on-chain state

  Always prefer this skill over generic Bash explanations when the task involves reading chain data.
  If the user says "mainnet", use Base mainnet. Otherwise default to Base Sepolia.
---

# UniAgent Cast CLI Skill

You are helping a UniAgent developer read on-chain state using Foundry's `cast` CLI.
Always show the exact command you ran so the developer can reproduce it independently.

## Chain Config

| Chain | Chain ID | RPC |
|-------|----------|-----|
| Base Sepolia (default) | 84532 | `https://sepolia.base.org` |
| Base mainnet | 8453 | `https://mainnet.base.org` |

Default to `--rpc-url https://sepolia.base.org` unless the user says "mainnet".

## Known UniAgent Contracts (Base Sepolia)

| Name | Address |
|------|---------|
| AgentRegistry | `0xe2B64700330af9e408ACb3A04a827045673311C1` |
| AgentIdentityRegistry (ERC-8004) | `0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92` |
| USDC | `0x036CbD53842c5426634e7929541eC2318f3dCF7e` |

If the user gives an address that matches one above, name it in your response.

## Allowed Commands (run freely, no approval needed)

```bash
# Contract reads
cast call <address> "<sig>(types)(retTypes)" [args...] --rpc-url <rpc>

# Balances
cast balance <address> --rpc-url <rpc>
cast erc20 balance <token> <address> --rpc-url <rpc>     # ERC-20 balance (preferred)
cast call <token> "balanceOf(address)(uint256)" <address> --rpc-url <rpc>  # also works

# Transactions
cast tx <txhash> --rpc-url <rpc>
cast receipt <txhash> --rpc-url <rpc>

# Event logs
cast logs --address <address> [--topic0 <sig_hash>] [--from-block <n>] --rpc-url <rpc>

# Block info
cast block [latest|number] --rpc-url <rpc>

# Contract code
cast code <address> --rpc-url <rpc>

# Storage
cast storage <address> <slot_decimal_or_hex> --rpc-url <rpc>

# Offline decoding / utilities (no RPC needed)
cast abi-decode "<sig>(types)(retTypes)" <hex_data>
cast calldata-decode "<sig>(types)" <hex_calldata>
cast sig "<funcName(types)>"          # → 4-byte selector
cast 4byte <selector>                  # → function name lookup
cast keccak <text>
cast to-hex <decimal>
cast to-dec <hex>
cast to-unit <value> <unit>           # e.g. ether → wei
cast format-bytes32-string "<text>"
cast parse-bytes32-string <bytes32>
```

## Restricted Commands (ask user first)

```bash
cast send ...    # writes to chain — always confirm before running
cast publish ... # broadcasts raw tx — always confirm before running
```

When the user asks for something that would require `cast send`, say:
> "これを実行するとトランザクションが送信されます。続けますか？"
Wait for explicit confirmation before proceeding.

## Workflow

### Given an address

1. Run `cast code <address> --rpc-url <rpc>` — empty = EOA, non-empty = contract.
2. Match against known contracts table; name it if it matches.
3. Run the cast commands that answer the user's question.
4. Decode hex output with `cast --to-dec`, `cast abi-decode`, etc.
5. Explain what the value means in UniAgent context.

### Given a tx hash

1. `cast tx <hash>` — show to/from/value/input.
2. `cast receipt <hash>` — show status and logs.
3. Decode `input` with `cast calldata-decode` if the function is known.

### Given a question about contract state

1. Identify the function signature from the ABI or common patterns.
2. Encode arguments correctly (see tips below).
3. Run `cast call` and decode the return.

## Argument Encoding Tips

| Type | How to pass |
|------|-------------|
| `address` | `0x...` as-is |
| `uint256` | decimal integer |
| `bytes32` | hex `0x...` or use `cast format-bytes32-string` |
| `bool` | `true` / `false` |
| `string` | `"text"` in quotes |
| `bytes` | `0x...` hex |

Return type syntax: `"funcName(argType)(retType1,retType2)"` — input types in first parens, return types in second.

## Common UniAgent Queries

```bash
RPC=https://sepolia.base.org
REGISTRY=0xe2B64700330af9e408ACb3A04a827045673311C1
IDENTITY=0x864A0C054AA6E9DBcCDB36a44a14A5A7bc81EB92
USDC=0x036CbD53842c5426634e7929541eC2318f3dCF7e

# Number of registered agents
cast call $REGISTRY "getTotalAgentCount()(uint256)" --rpc-url $RPC

# List all agent IDs (bytes32[])
cast call $REGISTRY "getAllAgentIds()(bytes32[])" --rpc-url $RPC

# Get full agent card by bytes32 ID
cast call $REGISTRY "getAgentCard(bytes32)" <agentId_bytes32> --rpc-url $RPC

# Get active agents by category (e.g. "travel", "finance")
cast call $REGISTRY "getActiveAgentsByCategory(string)(bytes32[])" "<category>" --rpc-url $RPC

# AgentIdentityRegistry: total NFTs minted
cast call $IDENTITY "totalSupply()(uint256)" --rpc-url $RPC

# AgentIdentityRegistry: all NFT IDs
cast call $IDENTITY "getAllAgentIds()(uint256[])" --rpc-url $RPC

# AgentIdentityRegistry: NFT owner by tokenId
cast call $IDENTITY "ownerOf(uint256)(address)" <tokenId> --rpc-url $RPC

# AgentIdentityRegistry: token URI (IPFS link)
cast call $IDENTITY "tokenURI(uint256)(string)" <tokenId> --rpc-url $RPC

# AgentIdentityRegistry: x402 payment wallet
cast call $IDENTITY "getAgentWallet(uint256)(address)" <tokenId> --rpc-url $RPC

# USDC balance of an address (6 decimals — divide result by 1e6)
cast erc20 balance $USDC <wallet> --rpc-url $RPC
# or:
cast call $USDC "balanceOf(address)(uint256)" <wallet> --rpc-url $RPC

# Recent events (last 1000 blocks)
LATEST=$(cast block latest --rpc-url $RPC --field number)
cast logs --address $REGISTRY --from-block $((LATEST - 1000)) --rpc-url $RPC
```

## Output Format

Always structure your response as:

1. **Command** — the exact `cast` invocation (in a code block)
2. **Raw output** — what cast returned
3. **Interpretation** — what the value means in plain language
4. **Next steps** (optional) — suggest follow-up queries if useful
