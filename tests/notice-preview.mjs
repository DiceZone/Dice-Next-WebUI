export function createNoticePreview(samples) {
  const catalog = [{ op: 'trust', area: 1 }, { op: 'friend_add', area: 2 }, { op: 'update_available', area: 2 }, { op: 'admin', area: 4 }, { op: 'error', area: 8 }];
  const rules = Array.from({ length: 27 }, (_, i) => ({ id: `notice-${i}`, name: i === 0 ? '' : `通知规则 ${i + 1}`, enabled: i % 5 !== 0,
    subscription: 'levels', level_mask: 15, events: [], source: { mode: 'all', platforms: [], adapter_ids: [], include_system: true },
    channels: [{ kind: 'chat', platform: 'onebot_v11', chat_id: i === 0 ? '192499947' : String(933145116 + i), is_group: i !== 0,
      name: i === 0 ? '192499947' : `冒险小队 ${i}`, display_name: i === 0 ? '随春生' : `冒险小队 ${i}`, delivery: 'auto', adapter_ids: [] }] }));
  const accounts = samples.adapters.map((a, i) => ({ id: String(a.id || i + 1), name: a.name, platform: a.type || 'onebot_v11', login_id: a.loginId || '', login_name: a.loginName || a.name }));
  return (method, path, url, body) => {
    if (path === '/system/notice/meta') return { accounts, catalog, smtp_ready: true, smtp_host: 'smtp.example.com', smtp_from: 'dice@example.com' };
    if (path === '/system/notice/targets') {
      const group = url.searchParams.get('kind') === 'group';
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const choices = (group ? samples.groups : samples.players).map(item => ({ kind: 'chat', platform: item.platform, chat_id: item.groupId || item.userId,
        name: item.name || item.nickname, is_group: group, delivery: 'auto', adapter_ids: [] })).filter(item => JSON.stringify(item).toLowerCase().includes(q));
      const page = Number(url.searchParams.get('page') || 1), size = Number(url.searchParams.get('pageSize') || 5);
      return { items: choices.slice((page - 1) * size, page * size), page, total: choices.length, pageSize: size };
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
