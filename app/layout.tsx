import type { Metadata, Viewport } from "next";
import { DM_Sans, Instrument_Serif } from "next/font/google";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { defaultBusiness } from "@/lib/defaults";
import { siteUrl } from "@/lib/site";
import "./globals.css";

/**
 * Instrument Serif (headlines) and DM Sans (everything else), loaded
 * through next/font: the files are downloaded once at build time and
 * served from this site, so visitors never contact Google. Each has a
 * fallback stack with matched metrics, so text doesn't jump while the
 * font loads.
 */
const serif = Instrument_Serif({
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  variable: "--font-instrument-serif",
  display: "swap",
  fallback: ["Iowan Old Style", "Palatino Linotype", "Georgia", "serif"],
});

const sans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const title = `${defaultBusiness.name} — Small-batch sourdough for local pickup`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: title, template: `%s — ${defaultBusiness.name}` },
  description: defaultBusiness.tagline,
  openGraph: {
    type: "website",
    siteName: defaultBusiness.name,
    title,
    description: defaultBusiness.tagline,
    url: "/",
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#f7f3ea",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable}`}>
      <body className="bg-cream font-sans text-espresso antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:bg-espresso focus:px-4 focus:py-3 focus:text-cream"
        >
          Skip to content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
