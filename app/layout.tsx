import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ClerkMe | Your Clinical Clerking Companion",
  description: "A structured clinical clerking and learning companion for medical students across Africa. Practise history taking, examination and clinical reasoning.",
  applicationName: "ClerkMe",
  keywords: ["clinical clerking", "medical students", "OSCE", "clinical skills", "Africa"],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
