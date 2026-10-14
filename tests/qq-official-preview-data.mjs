// In-memory QQ fixtures only. No credentials, real OpenIDs or network calls.
export function createQQOfficialPreview() {
  const accounts = new Map();
  for (const id of ['preview-qq', 'preview-qq-two']) {
    accounts.set(id, { version: 1, menu: { items: [
      { name: '帮助', type: 'send_message', send_message: '.help' },
      { name: '更多', type: 'menu', sub_menu_items: [{ name: '今日人品', type: 'send_message', send_message: '.jrrp' }, { name: '文档', type: 'link', link: 'https://example.invalid/docs' }] },
      { name: '搜索', type: 'switch', switch: { switch_id: 'search', default: false } },
    ] }, panels: ['c2c', 'group', 'channel', 'dm'].map((scope, index) => ({
      panel_id: `preview-${scope}-${id}`, scope, target_type: scope === 'group' ? 'specific' : 'all', version: 1,
      user_openids: [], group_openids: scope === 'group' ? ['demo-group-alpha', 'demo-group-beta'] : [],
      panel: { remark: ['私聊常用指令', '群内工具', '频道工具', '频道私信工具'][index], items: [
        { name: '.help', type: 'command', desc: '查看指令帮助', only_admin: false },
        { name: '.bot off', type: 'command', desc: '关闭普通响应', only_admin: true },
        { name: '文档', type: 'link', desc: '使用说明', link: 'https://example.invalid/docs', only_admin: false },
      ] },
    })), sequence: 0 });
  }
  const actions = ['qq_get_menu', 'qq_set_menu', 'qq_list_panels', 'qq_get_panel', 'qq_create_panel', 'qq_update_panel', 'qq_delete_panel', 'qq_panel_target'];
  return (id, action, params = {}) => {
    const account = accounts.get(id); if (!account) throw new Error('Unknown preview account');
    if (!action) return { actions, capabilities: {} };
    if (!actions.includes(action)) throw new Error('Unsupported preview action');
    if (action === 'qq_get_menu') return structuredClone({ version: account.version, menu: account.menu });
    if (action === 'qq_set_menu') { account.menu = structuredClone(params.body.menu); return { version: ++account.version }; }
    if (action === 'qq_list_panels') {
      const all = account.panels.filter((panel) => panel.scope === params.scope), start = Number(params.cursor || 0), limit = params.limit || 20;
      return structuredClone({ records: all.slice(start, start + limit), is_end: start + limit >= all.length, next_cursor: start + limit < all.length ? String(start + limit) : '' });
    }
    if (action === 'qq_create_panel') {
      const panel_id = `preview-created-${id}-${++account.sequence}`;
      account.panels.unshift({ ...structuredClone(params.body), panel_id, version: 1 }); return { panel_id };
    }
    const record = account.panels.find((panel) => panel.panel_id === params.panelId); if (!record) throw new Error('Panel not found');
    if (action === 'qq_get_panel') return structuredClone(record);
    if (action === 'qq_update_panel') { record.panel = structuredClone(params.body.panel); return { version: ++record.version }; }
    if (action === 'qq_delete_panel') { account.panels = account.panels.filter((panel) => panel !== record); return {}; }
    if (record.target_type !== 'specific' || !['c2c', 'group'].includes(record.scope)) throw new Error('Specific targets required');
    const field = record.scope === 'group' ? 'group_openids' : 'user_openids', ids = record.scope === 'group' ? params.groupOpenIds : params.userOpenIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 20) throw new Error('1–20 targets required');
    record[field] = params.op === 'add' ? [...new Set([...(record[field] || []), ...ids])] : (record[field] || []).filter((id) => !ids.includes(id));
    return {};
  };
}
