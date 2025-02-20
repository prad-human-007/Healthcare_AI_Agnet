import type { Metadata } from "next";
import "./globals.css";


export const metadata: Metadata = {
  title: "Healthcare AI Agnet",
  description: "AI agent for healthcare",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}
