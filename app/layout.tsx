import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClerkMe | AI Clinical Exam Prep & Clerking",
  description: "Clinical learning and exam preparation for medical students. Turn lectures into detailed study guides and SBA questions, read your source documents in-app, discover YouTube lectures, and practise clerking, OSCE, Viva and clinical simulation.",
  applicationName: "ClerkMe",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/clerkme-icon.svg", type: "image/svg+xml" },
      { url: "/clerkme-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/clerkme-192.png",
  },
  keywords: ["clinical clerking", "medical students", "AI exam preparation", "SBA questions", "YouTube medical lectures", "OSCE", "Viva", "clinical simulation", "Africa"],
};

export const viewport: Viewport = {
  themeColor: "#102D5A",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous"/>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet"/>
      </head>
      <body>{children}</body>
    </html>
  );
}
