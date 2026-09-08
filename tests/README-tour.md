# Tutorial regression checks

Run `npm test` and `npm run build` for types, fixture consistency and the existing onboarding tests.

For browser checks, run `npm run test:tour-preview` and open `http://127.0.0.1:5173`. This local-only server supplies empty installation data, intercepts all `/api/` requests before the normal backend proxy, and rejects mutations. It never seeds or connects to a real Dice database.

- Choose the new-user option, or replay a completed page using the header question mark.
- Check dashboard, statistics, playground, adapters, replies (including match preview), commands, help, groups, players, logs, permissions, decks, plugins, rules, AI, settings, notices, schedules and backups.
- The existing page components must render sample records with the tutorial notice, not a separate mock page or loading skeleton.
- Check next/back, finish, close, Escape/continue, close-all, and manual replay after close-all.
- Type a schedule name without saving, replay the tour, then exit: the original draft must return.
- Tab/Shift+Tab must stay inside the tutorial or its exit confirmation. Global search shortcuts must not open another dialog. Clicking the backdrop must only ask to exit, not activate a background control.
- `http://127.0.0.1:5173/__tour-test/requests` must contain no non-GET requests during an empty-install tour, including no `/replies/test` calls and no requests for `demo-` records.
- Open `http://127.0.0.1:5173/tests/tour-state.html`: all seven state regression checks must say PASS (draft restoration, ignored sample-derived effects, and late real responses).

The projection lives in `TourDataContext` and the `useTourValue` / `useTourState` hooks. Samples belong in `src/lib/tour-samples.ts`; they must not be put into Zustand stores, local storage, an API cache or the backend. Any effect that normally sends user input to an API must explicitly pause while `useTourActive()` is true. New routes must mount with live data before opening their tour.

Application metadata such as the actual version, roadmap and current theme remains real; sample data is for the configurable/user-owned content. Existing version-4 tutorial completion marks remain valid.
