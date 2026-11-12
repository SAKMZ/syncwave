# Changelog

Notable changes to Syncwave. Versions follow [semantic versioning](https://semver.org).
Full notes for each release are on the [releases page](https://github.com/SAKMZ/syncwave/releases).

## Unreleased

### Added
- A room can be created with a fixed `code`, so it has a permanent address (`/r/WORK`) that survives a restart instead of a fresh random one. `POST /api/rooms` takes an optional `code`; a collision is a `409`. Random codes stay the default.

### Fixed
- **The room advanced only when the host's audio ended.** Advance was gated on the host's socket *and* the host's own `<audio>` element firing `ended`, so a backgrounded tab, a locked phone or an errored element left the room sitting at the end of a track until someone vote-skipped. Any listener may now report it; the server keeps the first report that matches the track it believes is current. A 3 s per-room debounce keeps `repeat: one` — which replays the same `videoId` — from advancing once per listener.
- **A stalled download hung the room and leaked a slot.** `runDownload` had no timeout, so a yt-dlp child that never exits left `preparing` set (everyone sees buffering) and the download slot taken; three of those and nothing loaded again. It is now killed after 90 s without progress, or 8 minutes total.
- **Duplicate tracks in the queue.** Adding a track that is already queued returns the existing entry and says so ("already in the queue — upvote it to move it up") instead of queueing a second copy.
- **Mute did nothing on iPhone**, and was skipped during the crossfade at every track change — `volume` is ignored when set programmatically there, only `muted` counts.
- **"Add to Home Screen" produced a blank tile on iOS**, which ignores an SVG `apple-touch-icon`. Added 180/192/512 PNGs and wired both manifests.
- **The fine-sync constants assumed a LAN.** Over cellular and a VPN the clock estimate is only good to ~100 ms, so `playbackRate` was rewritten every second and iOS turned that into stutter. Tolerance is now 300 ms, the nudge is gentler, and the hard seek is 1.5 s.
- **The "address changes each time you restart" caveat showed on a stable domain.** It only applies to the `--share` quick tunnel.

## 1.3.0 · 2026-10-27

### Added
- **Paste a link to queue it.** A YouTube or YouTube Music song, playlist or album, or a Spotify track, album or playlist (up to 100 tracks). Spotify tracks are matched to YouTube Music by title, artist and length; any that can't be matched are listed rather than guessed. No Spotify account or key needed.
- **Synced lyrics** from [LRCLIB](https://lrclib.net). Tap *Lyrics* on the now-playing card and the current line follows the room's clock, so everyone is on the same line.
- **Audio delay** in the new *Sound settings* (the sliders icon in the room's header). Bluetooth headphones and speakers play sound 100–300 ms late; setting the delay plays that far ahead so what you hear lines up with everyone else. Saved per device.
- `LINK_IMPORT_LIMIT` caps link imports per address per hour (default 30).

### Changed
- **Tighter sync for everyone.** Drift under 0.75 s used to be left alone. It's now closed by playing up to 4% faster or slower until it's gone, which keeps listeners within a few tens of milliseconds without an audible jump.
- An album's *Add all* queues the whole album in one go: one activity line ("queued 13 tracks from …") and only the next couple of songs pre-fetched, instead of a line and a download per track.

## 1.2.0 · 2026-09-26

### Added
- yt-dlp keeps itself up to date: checked at boot when due, weekly after that, and early after a 403. An outdated yt-dlp fails every track with `HTTP Error 403`, which looks like an IP block but usually isn't. Turn off with `YTDLP_AUTO_UPDATE=false`.
- A 403 now tells the room it's most likely an outdated yt-dlp being updated, instead of a raw yt-dlp error.
- Project website at [syncwave.awetomiq.com](https://syncwave.awetomiq.com), built from `site/`.
- Contributor docs: `CONTRIBUTING.md`, `SECURITY.md`, a code of conduct, issue and PR templates, and `docs/FAQ.md`.

### Fixed
- The nightly update timer pointed at `/opt/apps/syncwave`, a path from an old deployment. It now uses `/opt/syncwave`, the installer's default.

### Changed
- A shorter README with fresh screenshots.

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
