# Syncwave — single-container build (Next.js + Socket.io + yt-dlp)
FROM node:20-bookworm-slim

# Runtime deps: ffmpeg (m4a extraction) + python3 (youtube-dl-exec installs the
# Python build of yt-dlp, whose shebang is `#!/usr/bin/env python3`).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates curl unzip \
  && rm -rf /var/lib/apt/lists/*

# Deno: yt-dlp needs a JavaScript runtime to solve YouTube's player challenge.
# Without one it warns "extraction without a JS runtime has been deprecated" and
# silently falls back to limited clients that get bot-checked. Deno is the only
# runtime yt-dlp enables by default.
RUN set -eux; \
  case "$(dpkg --print-architecture)" in \
    amd64) DENO_ARCH='x86_64-unknown-linux-gnu' ;; \
    arm64) DENO_ARCH='aarch64-unknown-linux-gnu' ;; \
    *) echo "unsupported architecture: $(dpkg --print-architecture)" >&2; exit 1 ;; \
  esac; \
  curl -fsSL "https://github.com/denoland/deno/releases/latest/download/deno-${DENO_ARCH}.zip" -o /tmp/deno.zip; \
  unzip -oq /tmp/deno.zip -d /usr/local/bin; \
  rm /tmp/deno.zip; \
  chmod +x /usr/local/bin/deno; \
  deno --version

WORKDIR /app

# Install deps first for better layer caching. postinstall fetches the yt-dlp
# binary; the build step needs devDependencies, so install everything.
# Skip youtube-dl-exec's build-time check for a `python` binary (Debian provides
# `python3`, not `python`); python3 is installed above for actual runtime use.
# --omit=optional skips ffmpeg-static: that exists so desktop users don't have to
# install ffmpeg by hand, but this image already has it from apt above.
COPY package.json package-lock.json* ./
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm install --omit=optional

# App source + production build (Next fetches the Sora font at build time).
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV CACHE_DIR=/app/cache
ENV DATA_DIR=/app/data
EXPOSE 3000

CMD ["node", "server.mjs"]
