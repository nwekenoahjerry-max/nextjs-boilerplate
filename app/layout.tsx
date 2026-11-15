import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClerkMe | Your Clinical Clerking Companion",
  description: "A structured clinical clerking and learning companion for medical students across Africa. Practise history taking, examination and clinical reasoning.",
  applicationName: "ClerkMe",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/clerkme-icon.svg",
    apple: "/clerkme-192.png",
  },
  keywords: ["clinical clerking", "medical students", "OSCE", "clinical skills", "Africa"],
};

export const viewport: Viewport = {
  themeColor: "#4b328c",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
