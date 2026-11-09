import type { Metadata, Viewport } from "next";
import { StoreProvider } from "@/lib/store";
import Banner from "@/components/Banner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nepal AI Buyer — prototype",
  description: "An AI that calls Kathmandu shops, bargains in Nepali and finds you the best price.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#b4232a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <StoreProvider>
          <main className="app">
            <Banner />
            {children}
          </main>
        </StoreProvider>
      </body>
    </html>
  );
}
