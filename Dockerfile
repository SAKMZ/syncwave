# Syncwave — single-container build (Next.js + Socket.io + yt-dlp)
FROM node:20-bookworm-slim

# Runtime deps: ffmpeg (m4a extraction) + python3 (youtube-dl-exec installs the
# Python build of yt-dlp, whose shebang is `#!/usr/bin/env python3`).
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg python3 ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching. postinstall fetches the yt-dlp
# binary; the build step needs devDependencies, so install everything.
# Skip youtube-dl-exec's build-time check for a `python` binary (Debian provides
# `python3`, not `python`); python3 is installed above for actual runtime use.
COPY package.json package-lock.json* ./
RUN YOUTUBE_DL_SKIP_PYTHON_CHECK=1 npm install

# App source + production build (Next fetches the Sora font at build time).
COPY . .
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV CACHE_DIR=/app/cache
ENV DATA_DIR=/app/data
EXPOSE 3000

CMD ["node", "server.mjs"]
