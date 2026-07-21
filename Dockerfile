# Syncwave — single-container build (Next.js + Socket.io + yt-dlp)
FROM node:20-bookworm-slim

# yt-dlp (fetched by youtube-dl-exec's postinstall) needs ffmpeg for m4a extraction.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps first for better layer caching. postinstall fetches the yt-dlp
# binary; the build step needs devDependencies, so install everything.
# yt-dlp ships as a self-contained binary, so skip youtube-dl-exec's build-time
# Python check (the slim image has no `python`; none is needed at runtime).
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
