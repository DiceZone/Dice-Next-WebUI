# Dice!Next WebUI

<p>
  <b>English</b> · <a href="README.zh-Hans.md">简体中文</a> · <a href="README.zh-Hant.md">繁體中文</a> · <a href="README.ja.md">日本語</a>
</p>

The frontend of the Dice!Next local admin panel. It talks to the backend API to configure bot connections, manage groups and users, maintain rule packs and plugins, and view session logs and game data.

## Scope

- Dashboard, system settings and adapter connection management.
- Groups, users, permissions and simulated chat.
- Character sheets, rule packs, JavaScript / Lua plugins and data management.
- Session log tables, game cards, log export and upload actions.
- Simplified Chinese, Traditional Chinese, English and Japanese interfaces.

"Quick actions" below the server info on the home page can be customized: click the adjust button at the top right, pick up to 6 page entries, reorder them with the up and down arrows, then save or restore the defaults. The preference is saved in the current browser; it doesn't change the bot configuration, and clearing the browser's site data restores the defaults. Searching "Quick actions" in global search also takes you there.

## Tech Stack

- React 18
- TypeScript
- Vite 6
- Tailwind CSS and Radix UI
- TanStack Router / Table

## Development

Requirements: Node.js 26.12.1 or a newer 26.x security release, with the bundled npm.
CI uses `26.x` and enforces the latest version; the minimum secure version is checked before building and the actual version is recorded.

```powershell
npm ci
npm run dev
```

Once the development server starts, it shows the local address. The actual API is served by the Dice!Next backend; start the backend first or configure a reachable backend address in the development environment.

## Checks and Builds

A separate GitHub Actions workflow runs tests, type checks, the production build and PWA artifact checks on push / PR. It only checks the frontend, without compiling the backend, publishing or deploying.

The isolated preview `npm run dev:preview` doesn't connect to a real bot. To see the actual text serialization results, compile `tools/reply-preview.cpp` from the main repository (linking `markdown.cpp`, `markdown_md4c.cpp`, MD4C and nlohmann JSON) and put the absolute path of the executable in `DICENEXT_UI_PREVIEW_RENDERER`. When it isn't configured, the preview clearly shows as unavailable instead of faking platform output with simple regexes.

```powershell
npm run lint
npm run build
```

`npm run build` generates `dist/`. The main program's packaging flow brings this directory into the Windows, Linux and macOS release packages; it shouldn't be committed to the repository.

## Install as an App

The WebUI provides an app manifest, so browsers that support it can install it as a standalone window app:

- Chrome / Edge: use the install icon in the address bar or the install app entry in the browser menu; the entry's name and when it appears are up to the browser.
- macOS Safari 17 and later: choose "Add to Dock" in the "File" menu.
- iPhone / iPad: choose "Add to Home Screen" in the browser's share menu.

Use HTTPS, or the local `http://localhost:port` / `http://127.0.0.1:port`. Plain HTTP on a LAN or public IP doesn't meet the browsers' security requirements for offering installation; don't turn off browser security restrictions for this.

What gets installed is the admin panel at the current address, not the bot backend. The backend still needs to run, and login checks stay the same; this feature doesn't register a Service Worker, add offline / API caching, or provide offline management or run the bot in the background. After the server address changes, install again from the new address.

The app icon reuses `public/favicon.svg`. After replacing it, run `npm run icons:generate` and commit the generated `public/icons/` files. After building, run `PWA_TEST_DIST=1 node --test tests/pwa.test.mjs` to check the release assets.

## Relationship to Other Projects

Browser regression tests always use the standalone samples in this repository and don't read sibling repositories automatically, so local and CI data match.
`node tests/ui-preview.mjs` shows the same samples manually; `npm run dev:preview` explicitly enables
`--workspace` and reads the full commands and texts when the sibling main program and documentation repositories are available. Neither mode connects to a real bot,
and changes are kept only inside the preview process.

This project is developed in the same workspace as `Dice-Next`, `Dice-Next-Doc` and `onedice-cpp-lib`. When packaging the backend, `DICENEXT_WEB_ROOT` points to this project's `dist/`; if the variable isn't set, the sibling `Dice-Next-WebUI` is used by default.

## Feedback

The project is still in internal development and testing. Please send problems, suggestions and test feedback through QQ group `933145116`.

## License

This project is released under the **GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later)**, the same as the [Dice-Next](https://github.com/DiceZone/Dice-Next) main repository. See [LICENSE](LICENSE) for the full terms.
