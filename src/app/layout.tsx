import type { Metadata } from "next";
import { Archivo, Instrument_Serif, Manrope } from "next/font/google";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";

const headlineSans = Archivo({
  subsets: ["latin"],
  variable: "--font-stack",
  display: "swap",
});

const bodySans = Manrope({
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
      className={`scheme-light ${headlineSans.variable} ${bodySans.variable} ${instrumentSerif.variable}`}
    >
      <body className="bg-canvas font-body text-ink print:bg-white">{children}</body>
    </html>
  );
}
