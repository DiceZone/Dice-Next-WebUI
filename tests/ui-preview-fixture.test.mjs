import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { startUiPreview } from './ui-preview.mjs';

test('imported preview uses a fixed standalone command catalog even beside real repositories', async () => {
  // Vite treats port 0 as its default, so reserve a loopback port explicitly.
  const reservation = createServer();
  await new Promise((resolve, reject) => {
    reservation.once('error', reject);
    reservation.listen(0, '127.0.0.1', resolve);
  });
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const server = await startUiPreview(port);
  try {
    const expected = ['r', 'ra', 'sc', 'br', 'dnd', 'st', 'draw', 'log', 'jrrp', 'bot', 'ai', 'help', 'master', 'group', 'system'];
    for (const locale of ['zh-Hans', 'zh-Hant', 'en', 'ja']) {
      const response = await fetch(`http://127.0.0.1:${port}/api/commands?locale=${locale}`);
      assert.equal(response.status, 200);
      const { code, data } = await response.json();
      assert.equal(code, 0);
      assert.deepEqual(data.map(command => command.cmd), expected);
      const check = data.find(command => command.cmd === 'ra');
      assert.equal(check.category, 'COC');
      assert.equal(check.example, '.ra');
      assert.equal(data[0].replies[0].default, '**{nick}** 掷出了 {expr} = **{result}**');
    }
  } finally {
    await server.close();
  }
});
