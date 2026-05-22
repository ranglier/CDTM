import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, IBM_Plex_Sans } from "next/font/google";

import "ol/ol.css";
import "./globals.css";

const uiFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ui",
});

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "CDTM - Map",
  description: "Carte publique des cases stables du projet CDTM sur fond statique CTM.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="fr">
      <body className={`${uiFont.variable} ${displayFont.variable} bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  );
}
