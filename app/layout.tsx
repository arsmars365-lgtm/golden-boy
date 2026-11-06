import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { FavoritesProvider } from "@/components/favorites-provider";
import { LanguageProvider } from "@/components/language-provider";
import RouteScrollToTop from "@/components/route-scroll-to-top";
import { ItemNotificationsProvider } from "@/lib/use-item-notifications";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Foundly — потерял или нашёл",
  description:
    "Объявления о потерянных и найденных вещах в университетском сообществе.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ru"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ItemNotificationsProvider>
          <LanguageProvider>
            <FavoritesProvider>
              <RouteScrollToTop />
              {children}
            </FavoritesProvider>
          </LanguageProvider>
        </ItemNotificationsProvider>
      </body>
    </html>
  );
}
