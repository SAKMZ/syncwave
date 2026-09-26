# Changelog

Notable changes to Syncwave. Versions follow [semantic versioning](https://semver.org).
Full notes for each release are on the [releases page](https://github.com/SAKMZ/syncwave/releases).

## Unreleased

- Project website at [syncwave.awetomiq.com](https://syncwave.awetomiq.com), built from `site/`.
- The nightly update timer now points at `/opt/syncwave`, the installer's default, instead of a path from an old deployment.
- Contributor docs: `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct, and issue and PR templates.

## 1.1.1 · 2026-08-18

### Fixed
- With repeat set to "all", a track that failed to download was re-queued and retried forever, spawning a yt-dlp process each time. Failed tracks are no longer re-queued.
- Three failures in a row now stop playback with a notice instead of working through the whole queue.
- The room is told why a track failed (bot-check, rate limit, unavailable video) instead of a bare "skipping".

## 1.1.0 · 2026-08-18

### Added
- Lock-screen and headphone controls through the Media Session API.
- A 5-second crossfade between tracks.
- Loudness levelling: each track is measured after its first play and evened out to -14 LUFS from then on.
- Casting to Chromecast and AirPlay through the browser's Remote Playback API. Experimental.
- Host moderation: mute a listener's chat, remove someone with a 30-minute block, or make a room invite-only and approve each person.

### Fixed
- Six issues found in an audit of the release, including a removed listener's skip vote still counting and the crossfade leaving the wrong track playing when the queue changed mid-fade.
- Safe-area padding for the header and player when installed as an app on phones with a notch or home indicator.

### Changed
- License changed from MIT to [PolyForm Noncommercial 1.0.0](LICENSE). Personal, hobby and nonprofit use stay free; commercial use needs a separate agreement.

## 1.0.1 · 2026-08-03

### Added
- A cap of 3 concurrent downloads (`MAX_PARALLEL_DOWNLOADS`).
- A limit of 20 new rooms per address per hour (`ROOM_CREATE_LIMIT`).

### Fixed
- A refused room creation no longer navigates to `/r/undefined`.

## 1.0.0 · 2026-08-03

First stable release: synced rooms on a monotonic server clock, a shared queue with votes and drag-to-reorder, chat and reactions, presence, album-art theming, the optional AI DJ, the desktop launcher, Docker, and a self-updating systemd timer.
