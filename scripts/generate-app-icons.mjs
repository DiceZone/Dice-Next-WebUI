import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// 复用项目图标；生成文件随源码提交，不在用户访问时处理图片。
const publicDir = new URL('../public/', import.meta.url);
const source = await readFile(new URL('favicon.svg', publicDir));
const outputDir = new URL('icons/', publicDir);
await mkdir(outputDir, { recursive: true });

for (const [filename, size, ratio] of [
  ['app-192.png', 192, 0.8],
  ['app-512.png', 512, 0.8],
  // 以最大边 56% 居中，图案四角也在 maskable 的中央 80% 安全圆内。
  ['app-maskable-512.png', 512, 0.56],
  ['apple-touch-icon.png', 180, 0.8],
]) {
  const mark = await sharp(source, { density: 384 })
    .resize({ width: Math.round(size * ratio), height: Math.round(size * ratio), fit: 'inside' })
    .png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: '#fafbff' } })
    .composite([{ input: mark, gravity: 'centre' }])
    .png().toFile(fileURLToPath(new URL(filename, outputDir)));
}
