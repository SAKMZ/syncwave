import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Syncwave — listen together",
    short_name: "Syncwave",
    description: "Self-hosted, AI-powered collaborative listening rooms.",
    start_url: "/",
    display: "standalone",
    background_color: "#08080e",
    theme_color: "#08080e",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
