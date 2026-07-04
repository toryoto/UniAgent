import type { AssistantToolRoundPersisted } from '@agent-marketplace/shared';

type ToolRoundMutable = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result: string;
};

/** SSE の tool_call / tool_result を集約し、DB `tool_rounds` 用の配列を組み立てる */
export class AssistantTurnCollector {
  private order: string[] = [];
  private byId = new Map<string, ToolRoundMutable>();

  applyEvent(event: { type?: string; data?: Record<string, unknown> }): void {
    if (event.type === 'tool_call' && event.data) {
      const id = String(event.data.toolCallId ?? '');
      const name = String(event.data.name ?? '');
      if (!id) return;
      if (!this.byId.has(id)) {
        this.order.push(id);
        this.byId.set(id, {
          id,
          name,
          args: (event.data.args as Record<string, unknown>) ?? {},
          result: '',
        });
      }
      return;
    }

    if (event.type === 'tool_result' && event.data) {
      const id = String(event.data.toolCallId ?? '');
      if (!id) return;
      const result = String(event.data.result ?? '');
      const name = String(event.data.name ?? '');
      let cur = this.byId.get(id);
      if (!cur) {
        cur = { id, name, args: {}, result };
        this.order.push(id);
        this.byId.set(id, cur);
      } else {
        cur.result = result;
        if (name) cur.name = name;
      }
    }
  }

  buildToolRounds(): AssistantToolRoundPersisted[] | undefined {
    if (this.order.length === 0) return undefined;
    return this.order.map((tid) => {
      const r = this.byId.get(tid)!;
      return {
        id: r.id,
        name: r.name,
        args: r.args,
        result: r.result,
      };
    });
  }
}
