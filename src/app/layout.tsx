import type { Metadata } from "next";
import { Instrument_Sans } from "next/font/google";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Video Extraction Studio",
  description:
    "Solo vídeos: de vídeo a texto reconstruible. Módulos open source, Composer de JSON, sin APIs de pago.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`h-full antialiased ${instrument.variable}`}>
      <body className="min-h-full bg-[#fbfbfc] font-sans text-[#171719]">{children}</body>
    </html>
  );
}
