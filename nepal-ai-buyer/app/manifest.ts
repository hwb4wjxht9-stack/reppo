import type { MetadataRoute } from "next";

// Lets phones "Add to Home Screen" so the prototype opens like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nepal AI Buyer",
    short_name: "AI Buyer",
    start_url: "/",
    display: "standalone",
    background_color: "#faf7f2",
    theme_color: "#b4232a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
