import { startUiPreview } from '../ui-preview.mjs';
export default async function setup() {
  const server = await startUiPreview(43192);
  return async () => { await server.close(); };
}
