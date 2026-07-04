# UniAgent Documentation

Detailed architecture, design, and operational documentation. For a project overview and quick start, see the [root README](../README.md); for per-workspace setup, see each workspace's README.

## Architecture & Design

| Document                                         | Contents                                                                                                                                  |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| [architecture.md](architecture.md)               | System components, chat-execution and marketplace-sync flows, x402 payment sequence, trust model, security boundaries                     |
| [discovery-algorithm.md](discovery-algorithm.md) | Bayesian ε-greedy agent ranking — composite score (reliability / quality / stake / freshness), Bayesian smoothing, cold-start exploration |

## Guidelines

| Document                                                       | Contents                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| [coding-conventions.md](coding-conventions.md)                 | Layering, package placement rules, dependency direction, TSDoc policy (Japanese)                                          |
| [ai-agent-operational-notes.md](ai-agent-operational-notes.md) | Operational notes for AI coding agents — workspace responsibilities, external MCP tooling, verification policy (Japanese) |

## Runbooks & Notes

| Document                                                     | Contents                                                                                               |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| [contract-redeploy-runbook.md](contract-redeploy-runbook.md) | Step-by-step runbook for redeploying `AgentIdentityRegistry` and re-syncing dependent state (Japanese) |
| [../contracts/REDEPLOYMENT.md](../contracts/REDEPLOYMENT.md) | Redeployment order and caveats for `AgentIdentityRegistry` / `AgentStaking` (Japanese)                 |
| [react-message-history.md](react-message-history.md)         | Design note on restoring ReAct message history for LangChain (Japanese)                                |

## Images

Diagrams used across the documentation live in [`images/`](images/):

- `uniagent-system-arch.png` — full system architecture
- `x402-sequencial.png` — x402 payment sequence diagram
