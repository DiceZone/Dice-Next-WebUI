import { startUiPreview } from '../ui-preview.mjs';

export default async function setup() {
  const server = await startUiPreview(43192, { strictPort: false });
  const { port } = server.httpServer.address();
  process.env.PLAYWRIGHT_TEST_BASE_URL = `http://127.0.0.1:${port}`;
  return () => server.close();
}
