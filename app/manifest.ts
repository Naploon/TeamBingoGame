import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Bingo Challenge",
    short_name: "Bingo",
    description: "Mobile-first team bingo challenge app.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1e8",
    theme_color: "#10212f",
    icons: [
      {
        src: "/icon?size=192",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon?size=512",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
