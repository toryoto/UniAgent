/**
 * LLM-as-a-Judge 評価プロンプト
 *
 * カテゴリ別ルブリック + Chain of Thought 強制による定量評価
 */

export type AgentCategory = 'research' | 'travel' | 'general';

export interface EvaluationResult {
  reasoning: string;
  qualityRaw: number; // 1-5 (LLM出力)
  reliabilityRaw: number; // 1-5 (LLM出力)
  quality: number; // 0-100 (qualityRaw * 20、アプリ側で算出)
  reliability: number; // 0-100 (reliabilityRaw * 20、アプリ側で算出)
  tags: string[];
}

/** 1-5 スコアを 0-100 に変換 */
export const RAW_SCORE_TO_100 = 20;

/** 0-100 → uint8 (0-255) 変換 */
export function scaleToUint8(score: number): number {
  return Math.min(255, Math.max(0, Math.round((score / 100) * 255)));
}

const CATEGORY_RUBRICS: Record<AgentCategory, { quality: string; reliability: string }> = {
  research: {
    quality: `
1 (非常に低い): 質問に全く答えていない、または完全に的外れ
2 (低い): 部分的に答えているが、重要な情報が欠落、事実誤認が複数
3 (中程度): 主要な質問には答えているが、深さ・網羅性が不十分
4 (高い): 包括的で正確、十分な根拠・ソースに基づいている
5 (非常に高い): 卓越した網羅性、正確性、追加の洞察を提供`,
    reliability: `
1 (非常に低い): ハルシネーションが顕著、URL/ソースが架空
2 (低い): 一部事実と異なる記述、ソースの検証が不十分
3 (中程度): 概ね正確だが、一部検証困難な主張を含む
4 (高い): 事実に基づいており、ソースが明示されている
5 (非常に高い): 全ての主張が検証可能、信頼性のあるソースを提示`,
  },
  travel: {
    quality: `
1 (非常に低い): 旅行プランとして機能しない、的外れな提案
2 (低い): 基本的な情報はあるが、予算・好みへの配慮が不足
3 (中程度): 実用的なプランだが、最適化の余地が大きい
4 (高い): 予算・好みに合致した魅力的な提案、代替案も提示
5 (非常に高い): 卓越したプラン、独自の洞察、コスト最適化が秀逸`,
    reliability: `
1 (非常に低い): 存在しないホテル/フライト、架空の価格を提示
2 (低い): 情報が古い、価格が大幅に不正確
3 (中程度): 概ね正確だが、一部の情報（価格・空席等）が未検証
4 (高い): 現実的な提案、価格帯が適切、実在する施設のみ参照
5 (非常に高い): リアルタイムに近い情報、全てが検証可能`,
  },
  general: {
    quality: `
1 (非常に低い): タスクを全く遂行していない
2 (低い): 部分的にのみ遂行、重要な欠落あり
3 (中程度): 基本的なタスクは遂行しているが改善の余地あり
4 (高い): タスクを十分に遂行、品質が高い
5 (非常に高い): 期待を上回る品質、追加価値を提供`,
    reliability: `
1 (非常に低い): 出力が不正確、信頼できない
2 (低い): 一部不正確な情報を含む
3 (中程度): 概ね正確だが検証が困難
4 (高い): 正確で信頼性が高い
5 (非常に高い): 全ての情報が検証可能で正確`,
  },
};

export function getEvaluationPrompt(category: AgentCategory): string {
  const rubric = CATEGORY_RUBRICS[category] ?? CATEGORY_RUBRICS.general;

  return `あなたはAIエージェントの応答品質を評価する専門家ジャッジです。

## 評価対象
- ユーザーのリクエスト（タスク）
- エージェントの応答（結果）
- エージェントのカテゴリ: ${category}

## 評価ルブリック
### Quality（品質）スコア: 1-5
${rubric.quality}

### Reliability（信頼性）スコア: 1-5
${rubric.reliability}

## 評価手順（Chain of Thought）
必ず以下のステップを順番に実行してください。スコアを先に決めてから理由を後付けすることは禁止です。

ステップ1: タスクの要件を整理する
ステップ2: 応答が各要件をどの程度満たしているか分析する
ステップ3: Quality ルブリックの各アンカーと比較し、最も近いスコアを選択する
ステップ4: Reliability ルブリックの各アンカーと比較し、最も近いスコアを選択する
ステップ5: 特筆すべき特徴をタグとして付与する

## タグの候補
"accurate", "comprehensive", "hallucinated", "incomplete", "well-structured", "budget-aware", "creative", "outdated", "practical", "verified-sources"

## 出力形式
- qualityRaw: Quality ルブリックに基づく 1-5 の整数
- reliabilityRaw: Reliability ルブリックに基づく 1-5 の整数
- 必ず reasoning を先に記述し、その後にスコアを決定すること
- 0-100 への変換はアプリ側で行うため、1-5 の離散値のみを出力すること`;
}
