/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Audio + socket.io are handled by the custom server (server.mjs), not Next.
  // youtube-dl-exec finds its yt-dlp binary relative to its own files, so it
  // has to be loaded from node_modules rather than bundled into .next/server.
  serverExternalPackages: ["youtube-dl-exec"],
};

export default nextConfig;
