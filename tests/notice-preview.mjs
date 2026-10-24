export function createNoticePreview(samples) {
  const catalog = [[1, ['trust', 'alias', 'schedule_manage', 'notice_manage']], [2, ['friend_add', 'friend_req', 'group_invite', 'group_request', 'group_joined', 'group_left', 'leave', 'dismiss', 'blacklist_leave', 'nonfriend_leave', 'keyword_leave', 'group_ban', 'group_admin', 'group_size_leave', 'group_auto_clean', 'usergroup_leave', 'group_control', 'schedule', 'global', 'censor', 'update_available', 'update_result']], [4, ['admin', 'blacklist']], [8, ['error', 'leave_error', 'update_error']]].flatMap(([area, ops]) => ops.map(op => ({ op, area })));
  const rules = Array.from({ length: 27 }, (_, i) => ({ id: `notice-${i}`, name: i === 0 ? '' : `通知规则 ${i + 1}`, enabled: i % 5 !== 0,
    subscription: 'levels', level_mask: 15, events: [], source: { mode: 'all', platforms: [], adapter_ids: [], include_system: true },
    channels: [{ kind: 'chat', platform: 'onebot_v11', chat_id: i === 0 ? '192499947' : String(933145116 + i), is_group: i !== 0,
      name: i === 0 ? '192499947' : `冒险小队 ${i}`, display_name: i === 0 ? '随春生' : `冒险小队 ${i}`, delivery: 'auto', adapter_ids: [] }] }));
  const accounts = samples.adapters.map((a, i) => ({ id: String(a.id || i + 1), name: a.name, platform: a.type || 'onebot_v11', login_id: a.loginId || '', login_name: a.loginName || a.name }));
  accounts.push({ id: 'notice-demo-secondary', name: '备用骰娘', platform: 'onebot_v11', login_id: '10002', login_name: '备用骰娘' });
  const key = ch => JSON.stringify([ch.kind, ch.platform, ch.chat_id, ch.is_group, ch.to?.toLowerCase(), ch.url]);
  const windows = rules.map(rule => {
    const { channels, id, ...subscription } = rule;
    return { id: id + '@0', name: rule.name, enabled: rule.enabled, channel: channels[0], subscriptions: [subscription] };
  });
  windows[1].subscriptions.push({ ...structuredClone(windows[1].subscriptions[0]), source: { mode: 'accounts', adapter_ids: [accounts[0].id], platforms: [], include_system: false }, subscription: 'events', events: ['error'], level_mask: 8 });
  let nextId = 100;
  return (method, path, url, body) => {
    if (path === '/system/notice/meta') return { accounts, catalog, smtp_ready: true, smtp_host: 'smtp.example.com', smtp_from: 'dice@example.com' };
    if (path === '/system/notice/targets') {
      const group = url.searchParams.get('kind') === 'group';
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const choices = (group ? samples.groups : samples.players).map(item => ({ kind: 'chat', platform: item.platform, chat_id: item.groupId || item.userId,
        name: item.name || item.nickname, is_group: group, delivery: 'auto', adapter_ids: [] })).map(ch => ({ ...ch, notice_window_id: windows.find(w => key(w.channel) === key(ch))?.id })).filter(item => JSON.stringify(item).toLowerCase().includes(q));
      const page = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('pageSize') || 5);
      return { items: choices.slice((page - 1) * size, page * size), page, total: choices.length, pageSize: size };
    }
    if (path === '/system/notice/windows') {
      if (method === 'POST') {
        if (windows.some(w => key(w.channel) === key(body.channel))) throw new Error('该通知窗口已存在，请编辑已有窗口');
        const window = { ...body, id: 'notice-new-' + nextId++ }; windows.push(window); return { saved: true };
      }
      const q = (url.searchParams.get('q') || '').toLowerCase(), filtered = windows.filter(w => JSON.stringify(w).toLowerCase().includes(q));
      const size = Number(url.searchParams.get('pageSize') || 10), page = Math.min(Number(url.searchParams.get('page') || 1), Math.max(1, Math.ceil(filtered.length / size)));
      return { items: filtered.slice((page - 1) * size, page * size), page, size, total: filtered.length };
    }
    if (path.startsWith('/system/notice/windows/')) {
      if (path.endsWith('/test')) return { submitted: true };
      const i = windows.findIndex(w => w.id === decodeURIComponent(path.split('/').at(-1)));
      if (i < 0) throw new Error('Preview window not found');
      if (method === 'DELETE') windows.splice(i, 1);
      else {
        if (windows.some((w, index) => index !== i && key(w.channel) === key(body.channel))) throw new Error('该通知窗口已存在，请编辑已有窗口');
        windows[i] = { ...body, id: windows[i].id };
      }
      return { saved: true };
    }
    if (path === '/system/notice/rules') {
      if (method === 'POST') { const rule = { ...body, id: 'notice-' + Date.now() }; rules.push(rule); return rule; }
      const q = (url.searchParams.get('q') || '').toLowerCase(); const filtered = rules.filter(r => JSON.stringify(r).toLowerCase().includes(q));
      const size = Number(url.searchParams.get('pageSize') || 10), page = Math.min(Number(url.searchParams.get('page') || 1), Math.max(1, Math.ceil(filtered.length / size)));
      return { items: filtered.slice((page - 1) * size, page * size), page, size, total: filtered.length };
    }
    if (path.startsWith('/system/notice/rules/')) {
      const i = rules.findIndex(r => r.id === decodeURIComponent(path.split('/').at(-1)));
      if (i < 0) throw new Error('Preview rule not found');
      if (method === 'DELETE') rules.splice(i, 1); else rules[i] = { ...body, id: rules[i].id };
      return {};
    }
    return undefined;
  };
}
