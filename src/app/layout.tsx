import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Volunteer Bookshop Inventory",
  description: "Next.js application for barcode-based volunteer bookshop inventory."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
