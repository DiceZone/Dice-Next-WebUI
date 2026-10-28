# WebUI maintenance rules

- `main` is WebUI V1; `webui-v2` is WebUI V2 (preview). Maintain them separately.
- Until the human explicitly establishes V2 as stable AND removes V1, implement
  EVERY feature addition/removal and behavior/API change in BOTH UIs. Sync
  translations, search entries, help, tests and docs as appropriate. Different
  rendering/technology is allowed; functional parity is mandatory.
- For each UI change inspect the counterpart branch/worktree, implement its
  equivalent, run both test/build commands and report any sync that is blocked.
  Do not silently treat changing only one branch as task completion.
- Keep assets relative to each version directory (`vite base: './'`). Both
  versions share APIs, authentication and data. Version selection belongs to
  `config/webui.json` on the server, NOT a browser-only appearance preference.
- Preserve in-progress work. Do not commit without explicit user authorization.
  Use the existing human Git identity; never inject an AI/LLM email or author or
  attribution trailers. Commit only authorized changes with a Chinese
  `type(scope): 说明` subject. Do not push/release without explicit authorization.
