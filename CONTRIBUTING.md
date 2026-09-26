# Contributing to Syncwave

Thanks for taking the time. Bug reports, fixes and small features are all welcome.

## Before you start

- **Bugs:** open an [issue](https://github.com/SAKMZ/syncwave/issues/new/choose) using the bug template. Server logs and your install method (launcher, Docker or installer) save a lot of back and forth.
- **Features:** open an issue first to talk it through, so nobody spends a weekend on something that won't be merged.
- **Security problems:** please don't open a public issue. See [SECURITY.md](SECURITY.md).

## Running it locally

You need Node 20 or newer.

```bash
git clone https://github.com/SAKMZ/syncwave.git
cd syncwave
npm install
npm run dev
```

Then open http://localhost:3000.

Two things that aren't obvious:

- `server.mjs` and everything under `lib/*.mjs` run **outside** Next.js hot reload. After changing them, stop and restart `npm run dev`.
- If every track fails with `HTTP Error 403`, update yt-dlp first: `node_modules/youtube-dl-exec/bin/yt-dlp -U`. YouTube changes often and an outdated yt-dlp is the most common cause.

## Before opening a pull request

- `npm run typecheck` passes.
- The change is tested in a real room, ideally with a second browser joined as a listener.
- UI changes are checked at phone width as well as desktop.
- Keep pull requests focused on one thing. Unrelated clean-ups are easier to review separately.

## Project layout

| Path | What's there |
| --- | --- |
| `server.mjs` | One HTTP server for Next.js, Socket.io and the `/audio` stream |
| `lib/rooms.mjs` | Room state, the playback clock, queue and moderation |
| `lib/resolver.mjs` | Fetching, caching and serving audio with yt-dlp |
| `lib/dj.mjs` | The optional AI DJ |
| `components/` | The room UI |
| `site/` | The project website (static HTML, deployed separately) |

## License

Syncwave is under the [PolyForm Noncommercial License 1.0.0](LICENSE). By contributing, you agree your contribution is released under the same license.
