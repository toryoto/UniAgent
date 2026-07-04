export function WelcomeMessage() {
  return (
    <div className="mb-8 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-4 md:p-6">
      <h2 className="mb-2 text-base font-bold text-purple-300 md:text-lg">Welcome to UniAgent!</h2>
      <p className="mb-3 text-sm text-purple-200/80 md:text-base">
        UniAgent X will discover and execute external agents from the marketplace:
      </p>
      <ul className="space-y-2 text-xs text-purple-200/70 md:text-sm">
        <li>1. Search for agents using discover_agents</li>
        <li>2. Select the best agent considering price and ratings</li>
        <li>3. Execute agents with x402 payment via execute_and_evaluate_agent</li>
        <li>4. Deliver integrated results</li>
      </ul>
      <div className="mt-4 rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
        <p className="mb-2 text-xs font-semibold text-purple-300 md:text-sm">Slash Commands:</p>
        <ul className="space-y-1 text-xs text-purple-200/70">
          <li>
            <code className="rounded bg-purple-500/20 px-1.5 py-0.5 font-mono text-purple-300">
              /use-agent &lt;agent-id&gt;
            </code>{' '}
            - Execute a specific agent by ID
          </li>
        </ul>
      </div>
      <p className="mt-4 text-xs text-purple-300/60">
        Examples: &quot;Search for agents in the travel category&quot;, &quot;/use-agent 0x1234...
        Create a 3-day travel plan for Paris&quot;
      </p>
    </div>
  );
}
