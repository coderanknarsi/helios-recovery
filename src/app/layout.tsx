import type { Metadata, Viewport } from "next";
import { Inter, Fraunces } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://heliosrecoveryresidences.com"),
  title: {
    default: "Helios Recovery Residences — Structured Sober Living",
    template: "%s · Helios Recovery Residences",
  },
  description:
    "Helios Recovery Residences provides safe, structured, and supportive sober living homes that help people build lasting recovery.",
  openGraph: {
    title: "Helios Recovery Residences",
    description:
      "Safe, structured, and supportive sober living homes that help people build lasting recovery.",
    type: "website",
  },
  appleWebApp: {
    capable: true,
    title: "Helios Recovery",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#fffdf9",
  // Lets the portal draw into the iPhone safe areas when installed.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
