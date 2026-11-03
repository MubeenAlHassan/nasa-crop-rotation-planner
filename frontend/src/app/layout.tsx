import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rotation Atlas",
  description: "Compare crop rotations with historical NASA weather, transparent assumptions and farmer priorities.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
