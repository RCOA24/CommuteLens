import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Commute Lens", description: "Know what the job really costs." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
