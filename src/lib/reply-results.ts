import type { ReplyRule } from '../types/reply';

export const MAX_REPLY_WEIGHT = 999999;

export function replyResults(rule?: Pick<ReplyRule, 'results' | 'resultWeights' | 'replyContent'> | null) {
  const results = rule?.results?.length ? rule.results : [rule?.replyContent ?? ''];
  if (rule?.resultWeights?.length === results.length) {
    return { texts: [...results], weights: [...rule.resultWeights] };
  }
  const parsed = results.map((text) => {
    const marker = /::([0-9]{1,6})::/.exec(text);
    if (!marker || Number(marker[1]) === 0) return { text, weight: 1 };
    return { text: text.slice(marker.index + marker[0].length), weight: Number(marker[1]) };
  });
  return { texts: parsed.map((r) => r.text), weights: parsed.map((r) => r.weight) };
}

export function resultProbabilities(texts: string[], weights: number[]) {
  const effective = texts.map((text, i) => text.trim() && Number.isInteger(weights[i]) && weights[i] > 0 ? weights[i] : 0);
  const total = effective.reduce((sum, weight) => sum + weight, 0);
  return effective.map((weight) => total > 0 ? weight / total * 100 : 0);
}

export function validResultWeights(weights: number[]) {
  return weights.every((weight) => Number.isInteger(weight) && weight >= 0 && weight <= MAX_REPLY_WEIGHT);
}
