import type { Metadata } from "next";
import { Elms_Sans, Instrument_Serif, Stack_Sans_Headline } from "next/font/google";
import "./globals.css";

const stackSans = Stack_Sans_Headline({
  subsets: ["latin"],
  variable: "--font-stack",
  display: "swap",
});

const elmsSans = Elms_Sans({
  subsets: ["latin"],
  variable: "--font-elms",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Commute Lens",
  description: "Know what the job really costs.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`scheme-light ${stackSans.variable} ${elmsSans.variable} ${instrumentSerif.variable}`}
    >
      <body className="bg-canvas font-body text-ink print:bg-white">{children}</body>
    </html>
  );
}
