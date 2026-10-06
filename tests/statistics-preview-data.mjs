// Deterministic, in-memory visual examples; never connected to a real bot.
export function statisticsPreview(base, params) {
  const requestedDays = Number(params.get('days') || 7);
  const days = [7, 30, 90].includes(requestedDays) ? requestedDays : 7;
  const sizes = { '5m': 5, '1h': 60, '6h': 360, '1d': 1440 };
  const requestedGranularity = params.get('granularity') || '1h';
  const granularity = Object.hasOwn(sizes, requestedGranularity) && !(days > 7 && requestedGranularity === '5m') ? requestedGranularity : '1h';
  const platform = params.get('platform') || '';
  const adapter = params.get('adapter') || '';
  const options = [...base.filters.adapters, { id: 'demo-adapter-kook', name: '港灯 · 预览', platform: 'kook', connected: true }];
  const scope = options.filter(item => (!platform || item.platform === platform) && (!adapter || item.id === adapter));
  const end = Date.parse(base.daily_usage.at(-1).date + 'T00:00:00Z');
  const daily = Array.from({ length: days }, (_, index) => ({ date: new Date(end - (days - 1 - index) * 86_400_000).toISOString().slice(0, 10),
    commands: [8, 14, 10, 22, 16, 26, 32][index % 7], rolls: [6, 10, 8, 16, 12, 19, 24][index % 7] }));
  const buckets = new Map();
  let onlineSum = 0;
  let totalSum = 0;
  for (let day = 0; day < days; day++) {
    for (let minute = 0; minute < 1440; minute += 5) {
      if ((day === 0 && minute < 480) || (day === days - 1 && minute >= 1230)
        || (day === days - 1 && minute >= 1020 && minute < 1080)) continue;
      const incident = day === days - 1 || day % 3 === 2;
      const allOff = incident && minute >= 905 && minute < 920;
      const partial = incident && minute >= 615 && minute < 660;
      const online = scope.filter(item => !allOff && !(partial && item.platform === 'kook')).length;
      const timestamp = Date.parse(daily[day].date + 'T00:00:00Z') - 480 * 60_000 + minute * 60_000;
      const key = Math.floor(timestamp / (sizes[granularity] * 60_000)) * sizes[granularity] * 60_000;
      const previous = buckets.get(key);
      buckets.set(key, { sampled_at: new Date(key).toISOString(),
        online_count: previous ? Math.min(previous.online_count, online) : online, total_count: scope.length });
      onlineSum += online;
      totalSum += scope.length;
    }
  }
  const commands = daily.reduce((sum, row) => sum + row.commands, 0);
  const rolls = daily.reduce((sum, row) => sum + row.rolls, 0);
  return { ...base, summary: { ...base.summary, total_commands: commands, total_rolls: rolls,
      adapter_online: scope.length, adapter_total: scope.length, availability_rate: totalSum ? onlineSum / totalSum * 100 : 0 },
    filters: { ...base.filters, days, platform, adapter, platforms: ['onebot_v11', 'kook'], adapters: options, granularity },
    daily_usage: daily, online_history: [...buckets.values()],
    adapter_availability: scope.map(item => ({ ...item, uptime_percent: 99.2, samples: buckets.size })),
  };
}
