/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Audio + socket.io are handled by the custom server (server.mjs), not Next.
};

export default nextConfig;
