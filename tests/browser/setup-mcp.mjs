import { startUiPreview } from '../ui-preview.mjs';

export default async function setup() {
  // Own the fixture in-process. Teardown closes Vite explicitly, instead of
  // relying on Windows taskkill or leaving a background preview behind.
  const server = await startUiPreview(43191);
  return async () => { await server.close(); };
}
