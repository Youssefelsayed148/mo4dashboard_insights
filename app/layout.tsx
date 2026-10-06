import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MO4 Content Hub",
  description: "Your publications. One content and performance workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
