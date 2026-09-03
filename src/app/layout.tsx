import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Video Extraction Studio",
  description:
    "Solo vídeos: de vídeo a texto reconstruible. Módulos open source, Composer de JSON, sin APIs de pago.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[#fbfbfc] text-[#171719]">{children}</body>
    </html>
  );
}
