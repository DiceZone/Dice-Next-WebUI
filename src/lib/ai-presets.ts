// Prices verified against provider documentation on 2026-11-11, USD / 1M tokens.
// DeepSeek estimates use peak, cache-miss rates; actual billing can be lower.
export const providerPresets = [
  { id: 'deepseek', name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1' },
  { id: 'openai', name: 'OpenAI', base_url: 'https://api.openai.com/v1' },
  { id: 'claude', name: 'Claude', base_url: 'https://api.anthropic.com/v1' },
  { id: 'volcengine', name: 'Volcengine', base_url: 'https://ark.cn-beijing.volces.com/api/v3' },
  { id: 'siliconflow', name: 'SiliconFlow', base_url: 'https://api.siliconflow.cn/v1' },
] as const;

export const modelPresets = [
  { provider: 'deepseek', name: 'DeepSeek Flash', model: 'deepseek-flash', kind: 'chat', vision: true, price_in: 0.3, price_out: 1.2, source: 'https://api-docs.deepseek.com/quick_start/pricing/' },
  { provider: 'deepseek', name: 'DeepSeek V4 Pro', model: 'deepseek-v4-pro', kind: 'chat', vision: false, price_in: 1.32, price_out: 3.96, source: 'https://api-docs.deepseek.com/quick_start/pricing/' },
  { provider: 'siliconflow', name: 'BAAI/bge-m3', model: 'BAAI/bge-m3', kind: 'embedding', vision: false, price_in: 0, price_out: 0, source: 'https://siliconflow.cn/pricing' },
] as const;

export function providerPresetId(baseUrl: string): string | undefined {
  try {
    const url = new URL(baseUrl);
    return providerPresets.find((p) => new URL(p.base_url).origin === url.origin)?.id;
  } catch { return undefined; }
}

export const primaryAiUsages = ['reply', 'decision', 'vision', 'speech', 'embed'];
