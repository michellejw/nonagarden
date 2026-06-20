import type { Metadata } from "next";
import { Fredoka } from "next/font/google";
import "./globals.css";

// The Shroom Games UI face. 600 is the workhorse weight (per the design handoff).
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nonagarden",
  description: "A cozy nonogram garden — solve hidden pictures in the Shroom Games style.",
};

// Set data-theme from localStorage before first paint so dark mode never flashes.
const themeInit = `
(function () {
  try {
    var t = localStorage.getItem("theme");
    document.documentElement.dataset.theme = (t === "twilight" || t === "forest") ? t : "forest";
  } catch (e) {
    document.documentElement.dataset.theme = "forest";
  }
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="forest" className={`${fredoka.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body className="min-h-full flex flex-col bg-app text-ink">{children}</body>
    </html>
  );
}
