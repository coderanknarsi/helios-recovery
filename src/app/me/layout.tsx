import type { Metadata } from "next";

/**
 * The resident portal is private — keep it out of search engines. Auth is
 * enforced by the (portal) layout, not here, so /me/login stays reachable.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function ResidentPortalRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
