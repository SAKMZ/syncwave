# Syncwave FAQ

[← Back to the README](../README.md)

- [Using it](#using-it)
- [The AI DJ](#the-ai-dj)
- [Hosting it](#hosting-it)
- [Keyboard shortcuts](#keyboard-shortcuts)
- [How it works](#how-it-works)

## Using it

**Does everyone need Spotify, or Spotify Premium?**
No. Nobody needs an account with anything. Audio is fetched by your server and streamed from it, so listeners just open a link.

**Does it work on phones?**
Yes, and it was designed for them first. Rooms have swipeable panes, lock-screen controls, and can be installed to the home screen, where they reopen straight into the same room.

**How many people can be in a room?**
There's no built-in cap. The practical limit is your upload speed, since each listener streams the track from your machine. A group of friends on a home connection is comfortable.

**Can I run it alongside Discord?**
That's the most common setup: voice in Discord, music in a Syncwave room everyone has open. Unlike a music bot, everyone hears full quality and can queue, vote and see what's playing.

**Is it a Discord music bot, Watch2Gether, or Teleparty for music?**
Same idea, different shape: a web room you host yourself, with a real queue and a real player instead of a bot's text commands.

**Which browsers does it need?**
Anything from 2023 onward: Chrome or Edge 111+, Safari 16.4+, Firefox 113+. Older browsers will load it, but some colours will be off.

## The AI DJ

**Does the AI DJ have to be on?**
No. It's off by default and everything else works without it. Syncwave never contacts an AI provider until you configure one, and your key stays on your server.

**Do I have to pay for it?**
No. Pick **Ollama** and it runs on your own machine with no key, or use a free **Google Gemini** key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The DJ speaks about once a track, so a room of friends is unlikely to leave the free tier. OpenAI and Anthropic are supported if you already pay for one.

**How do I talk to it?**
Type `/dj` followed by what you want in chat, for example `/dj add 10 rainy day songs`. It queues the tracks and introduces them in the voice of the persona picked in `/admin`.

## Hosting it

**Where does the music come from?**
YouTube Music, fetched with yt-dlp and cached on your disk for 72 hours after its last play.

**Tracks won't play. What now?**
Start with [If tracks won't play](../DEPLOY.md#if-tracks-wont-play) in the deployment guide. The two usual causes are an outdated yt-dlp and a cloud server whose IP YouTube refuses.

**Can I run it on a VPS?**
Yes, but YouTube refuses most datacenter IPs, so you'll need a proxy pool or a cookies file. Both are a single setting in `/admin`. See [DEPLOY.md](../DEPLOY.md).

**Where is my data?**
Rooms and settings live in `./data`, cached audio in `./cache`. Back them up or delete them; nothing else on the machine is touched.

**Can I use it commercially?**
Not without a separate agreement. Syncwave is under the [PolyForm Noncommercial License](../LICENSE): free for personal, hobby and nonprofit use. Email hello@awetomiq.com about commercial licensing.

## Keyboard shortcuts

Press <kbd>?</kbd> in a room to see these at any time.

| Key | Action |
| --- | --- |
| <kbd>Space</kbd> | Play or pause *(host)* |
| <kbd>J</kbd> / <kbd>L</kbd> | Back 10 seconds / next track *(host)* |
| <kbd>M</kbd> | Mute |
| <kbd>/</kbd> or <kbd>⌘K</kbd> | Search |
| <kbd>Q</kbd> · <kbd>C</kbd> · <kbd>H</kbd> | Queue · chat · history |
| <kbd>F</kbd> | Like the current track |
| <kbd>Esc</kbd> | Close whatever is open |

## How it works

- A **Next.js** front end (App Router, React 19) is the room interface and the installable app.
- A **Socket.io** server is the single source of truth for the playback clock, queue, chat, presence and reactions. Each browser positions its audio from the server's timestamps, which is what keeps everyone in sync.
- An audio resolver fetches each track with **yt-dlp**, caches it to disk, measures its loudness, and serves it with HTTP range support. Search uses `ytmusic-api`.
- State is stored in plain JSON files, with no database. Cached audio is removed 72 hours after its last play, under a disk cap.

All of it runs in one process and one container.
