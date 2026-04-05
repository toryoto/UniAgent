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

/** SSE チャンクをまたいで `data: {...}` イベントを取り出す */
export function createSseEventBuffer() {
  let buf = '';
  return {
    push(chunk: string): Array<Record<string, unknown>> {
      buf += chunk;
      const events: Array<Record<string, unknown>> = [];
      while (true) {
        const idx = buf.indexOf('\n\n');
        if (idx === -1) break;
        const block = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        const dataLine = block.split('\n').find((l) => l.startsWith('data:'));
        if (!dataLine) continue;
        try {
          const json = dataLine.replace(/^data:\s*/, '').trim();
          if (json) events.push(JSON.parse(json) as Record<string, unknown>);
        } catch {
          // 無視
        }
      }
      return events;
    },
    flushTail(): Array<Record<string, unknown>> {
      const events: Array<Record<string, unknown>> = [];
      const trimmed = buf.trim();
      buf = '';
      if (!trimmed.startsWith('data:')) return events;
      try {
        const json = trimmed.replace(/^data:\s*/, '').trim();
        if (json) events.push(JSON.parse(json) as Record<string, unknown>);
      } catch {
        /* empty */
      }
      return events;
    },
  };
}
