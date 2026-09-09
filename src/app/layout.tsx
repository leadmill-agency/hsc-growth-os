import type { Metadata } from "next";
import { Oswald, Public_Sans } from "next/font/google";
import "./globals.css";

// Same faces as houstonsigncrafters.com: Oswald (condensed, signage-style display)
// + Public Sans (sturdy body grotesk).
const oswald = Oswald({
  variable: "--font-display-face",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const publicSans = Public_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HSC Growth OS",
  description: "Houston Sign Crafters — internal revenue operating system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${oswald.variable} ${publicSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-paper text-carbon">{children}</body>
    </html>
  );
}
