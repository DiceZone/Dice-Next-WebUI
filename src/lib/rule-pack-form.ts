// 表单内部表示（便于编辑），与规则包 JSON 双向转换。
// h 仅用于 customCmds（自定义指令的帮助文字，对应 add 值的 {output,help} 对象形式）。
export interface KV { k: string; v: string; h?: string; }
export interface PackForm {
  original: Record<string, unknown>;
  mechanics: string;
  options: Record<string, boolean>;
  name: string; fullName: string; version: string; author: string;
  setKeys: string; diceSides: string; successBuiltin: string;
  alias: KV[];      // k=规范名, v=别名(逗号分隔)
  defaults: KV[];   // k=属性, v=默认值
  computed: KV[];   // k=属性, v=公式
  entries: KV[];    // k=词条, v=解释
  disableCmds: string;   // 逗号分隔
  cmdAlias: KV[];   // k=输入词, v=目标指令
  customCmds: KV[]; // k=指令名, v=输出模板（含 {表达式} DSL）
}

// Keeper Companion modules: each is a separate switch. A pack saved before a
// module existed has no key for it, and the server then applies these defaults.
export const COC7R_OPTIONS = [
  ['creation', true], ['skills', true], ['movement', true], ['sanity', true],
  ['bases', false], ['specialties', false], ['take5', false],
] as const;

export const emptyForm = (): PackForm => ({
  original: {}, mechanics: '', options: {},
  name: '', fullName: '', version: '1.0', author: '', setKeys: '', diceSides: '100', successBuiltin: 'coc7',
  alias: [], defaults: [], computed: [], entries: [], disableCmds: '', cmdAlias: [], customCmds: [],
});

export function jsonToForm(j: Record<string, unknown>): PackForm {
  const f = emptyForm();
  f.original = structuredClone(j);
  f.mechanics = typeof j.mechanics === 'string' ? j.mechanics : '';
  const options = j.options;
  if (options && typeof options === 'object') for (const [key, value] of Object.entries(options))
    if (typeof value === 'boolean') f.options[key] = value;
  f.name = (j.name as string) || ''; f.fullName = (j.fullName as string) || '';
  f.version = (j.version as string) || '1.0'; f.author = (j.author as string) || '';
  const set = (j.set as Record<string, unknown>) || {};
  f.diceSides = String((set.diceSides as number) ?? 100);
  f.setKeys = Array.isArray(set.keys) ? (set.keys as string[]).join(', ') : '';
  const succ = (j.successLevels as Record<string, unknown>) || {};
  f.successBuiltin = (succ.builtin as string) || '';
  const objToKV = (o: unknown, joinArr = false): KV[] =>
    o && typeof o === 'object' ? Object.entries(o as Record<string, unknown>).map(([k, v]) =>
      ({ k, v: joinArr && Array.isArray(v) ? (v as string[]).join(', ') : String(v) })) : [];
  f.alias = objToKV(j.alias, true);
  f.defaults = objToKV(j.defaults);
  f.computed = objToKV(j.computed);
  f.entries = objToKV(j.entries);
  const cmds = (j.commands as Record<string, unknown>) || {};
  f.disableCmds = Array.isArray(cmds.disable) ? (cmds.disable as string[]).join(', ') : '';
  f.cmdAlias = objToKV(cmds.alias);
  // commands.add 值可为字符串(=模板) 或 {output, help} 对象；对象形式保留 help。
  if (cmds.add && typeof cmds.add === 'object')
    f.customCmds = Object.entries(cmds.add as Record<string, unknown>).map(([k, v]) =>
      typeof v === 'string'
        ? { k, v }
        : { k, v: String((v as Record<string, unknown>)?.output ?? ''), h: String((v as Record<string, unknown>)?.help ?? '') });
  return f;
}

export function formToJson(f: PackForm): Record<string, unknown> {
  const splitList = (s: string) => s.split(/[,，]/).map((x) => x.trim()).filter(Boolean);
  const kvObj = (rows: KV[], asInt = false) => {
    const o: Record<string, unknown> = {};
    for (const r of rows) if (r.k.trim()) o[r.k.trim()] = asInt ? (parseInt(r.v, 10) || 0) : r.v;
    return o;
  };
  const aliasObj: Record<string, string[]> = {};
  for (const r of f.alias) if (r.k.trim()) aliasObj[r.k.trim()] = splitList(r.v);
  const j: Record<string, unknown> = {
    ...structuredClone(f.original),
    name: f.name.trim(), fullName: f.fullName.trim() || f.name.trim(), version: f.version.trim(),
    set: { ...(f.original.set as Record<string, unknown> ?? {}), diceSides: parseInt(f.diceSides, 10) || 100, keys: splitList(f.setKeys) },
  };
  for (const key of ['author', 'alias', 'defaults', 'computed', 'entries']) delete j[key];
  if (f.mechanics) { j.mechanics = f.mechanics; j.options = { ...(f.original.options as Record<string, unknown> ?? {}), ...f.options }; }
  if (f.author.trim()) j.author = f.author.trim();
  if (f.successBuiltin) j.successLevels = { ...(f.original.successLevels as Record<string, unknown> ?? {}), builtin: f.successBuiltin };
  else if (j.successLevels && typeof j.successLevels === 'object') { delete (j.successLevels as Record<string, unknown>).builtin; }
  if (Object.keys(aliasObj).length) j.alias = aliasObj;
  if (f.defaults.length) j.defaults = kvObj(f.defaults, true);
  if (f.computed.length) j.computed = kvObj(f.computed);
  if (f.entries.length) j.entries = kvObj(f.entries);
  const disable = splitList(f.disableCmds);
  const cmdAlias = kvObj(f.cmdAlias);
  // 自定义指令：有帮助文字→写 {output,help} 对象，否则写纯字符串模板（保持简洁/向后兼容）。
  const customCmds: Record<string, unknown> = {};
  for (const r of f.customCmds)
    if (r.k.trim()) customCmds[r.k.trim()] = r.h && r.h.trim() ? { output: r.v, help: r.h.trim() } : r.v;
  const extraCommands = { ...(f.original.commands as Record<string, unknown> ?? {}) };
  for (const key of ['disable', 'alias', 'add']) delete extraCommands[key];
  delete j.commands;
  if (disable.length || Object.keys(cmdAlias).length || Object.keys(customCmds).length || Object.keys(extraCommands).length)
    j.commands = {
      ...extraCommands,
      ...(disable.length ? { disable } : {}),
      ...(Object.keys(cmdAlias).length ? { alias: cmdAlias } : {}),
      ...(Object.keys(customCmds).length ? { add: customCmds } : {}),
    };
  return j;
}
