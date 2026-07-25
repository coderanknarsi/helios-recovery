import type { Metadata } from "next";
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
