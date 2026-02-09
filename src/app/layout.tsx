import type { Metadata } from "next";
import { Space_Grotesk, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Providers from "@/components/Providers";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-heading",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Rage Quit — Cancel Subscriptions & Save Money",
    template: "%s | Rage Quit",
  },
  description:
    "Stop bleeding money. Start fighting back. Cancel unwanted subscriptions, discover retention offers, and scan contracts for dark patterns.",
  openGraph: {
    title: "Rage Quit — Cancel Subscriptions & Save Money",
    description:
      "Stop bleeding money. Start fighting back. Cancel unwanted subscriptions, discover retention offers, and scan contracts for dark patterns.",
    type: "website",
    siteName: "Rage Quit",
  },
  twitter: {
    card: "summary_large_image",
    title: "Rage Quit — Cancel Subscriptions & Save Money",
    description:
      "Stop bleeding money. Start fighting back.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${jetbrainsMono.variable} antialiased bg-[#0A0A0A] text-white`}
      >
        <Providers>
          <Navbar />
          <main className="min-h-screen pt-16 pb-16 md:pb-0">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
