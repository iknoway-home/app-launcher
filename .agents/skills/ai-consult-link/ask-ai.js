/**
 * プロンプト入りでユーザー自身のチャットAIを開く。APIキー不要。
 * 対応表と制約は同ディレクトリの SKILL.md を参照。
 */

/** エンコード後のURL全体の上限。日本語は1文字9文字に膨らむ。 */
export const MAX_URL_LENGTH = 6000;

export const AI_TARGETS = [
  // submits: 開いた瞬間に送信まで走る（ユーザーがプロンプトを直せない）
  { id: 'chatgpt', label: 'ChatGPT', submits: false, build: (p) => `https://chatgpt.com/?prompt=${p}` },
  { id: 'claude', label: 'Claude', submits: false, build: (p) => `https://claude.ai/new?q=${p}` },
  { id: 'perplexity', label: 'Perplexity', submits: true, build: (p) => `https://www.perplexity.ai/search/?q=${p}` },
  { id: 'grok', label: 'Grok', submits: true, build: (p) => `https://grok.com/?q=${p}` },
  // Gemini はプロンプトのパラメータを受け付けないため、コピーしてから開く
  { id: 'gemini', label: 'Gemini', submits: false, needsClipboard: true, build: () => 'https://gemini.google.com/app' },
];

export function findTarget(id) {
  const target = AI_TARGETS.find((t) => t.id === id);
  if (!target) throw new Error(`unknown AI target: ${id}`);
  return target;
}

export function buildUrl(targetId, prompt) {
  return findTarget(targetId).build(encodeURIComponent(prompt));
}

/**
 * 上限に収まるまで末尾を削る。URLが壊れるより、末尾が欠ける方がまし。
 * 呼ぶ前に「要約＋公開URL」で短くできないかを先に検討すること。
 */
export function fitToLimit(targetId, prompt) {
  let text = prompt;
  while (text.length > 0 && buildUrl(targetId, text).length > MAX_URL_LENGTH) {
    text = text.slice(0, Math.floor(text.length * 0.9));
  }
  return text === prompt ? text : `${text.trimEnd()}…`;
}

/** 非対応AIならクリップボードに入れてから開く。ポップアップブロック回避のため同期的に開く。 */
export function openAI(targetId, prompt) {
  const target = findTarget(targetId);
  const text = fitToLimit(targetId, prompt);
  if (target.needsClipboard) {
    navigator.clipboard?.writeText(text).catch(() => {});
  }
  window.open(buildUrl(targetId, text), '_blank', 'noopener');
  return target;
}
