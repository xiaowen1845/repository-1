import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logo Projection Simulator | GoboSolution",
  description: "Upload your logo, choose a scene, and see how your projection could look before selecting a projector.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
