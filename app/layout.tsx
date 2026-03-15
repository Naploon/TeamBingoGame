import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Bingo Challenge",
  description: "Mobile-first team bingo challenge app for live events.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Bingo Challenge",
  },
  formatDetection: {
    telephone: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
