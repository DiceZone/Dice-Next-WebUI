# WebUI maintenance rules

- On 2026-11-02 the human established the former V2 as the only WebUI. `main`
  is that UI. The old V1 is archived, read-only, on the `v1-webui` branch: do not
  port features back to it and do not reintroduce a version switch.
- Keep assets relative (`vite base: './'`) so reverse-proxy prefixes work.
- Sync translations (four languages), search entries, help, tests and docs with
  every UI change.
- Preserve in-progress work. Do not commit without explicit user authorization.
  Use the existing human Git identity; never inject an AI/LLM email or author or
  attribution trailers. Commit only authorized changes with a Chinese
  `type(scope): 说明` subject. Do not push/release without explicit authorization.
