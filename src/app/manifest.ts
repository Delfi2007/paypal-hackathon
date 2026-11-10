import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kitty, the AI treasurer for group money",
    short_name: "Kitty",
    description: "Collect, hold and spend a group's money through PayPal, inside a mandate the group signs.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#f5f7ff",
    theme_color: "#3b6cff",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
    shortcuts: [{ name: "My kitties", url: "/app" }, { name: "New kitty", url: "/new" }],
  };
}
