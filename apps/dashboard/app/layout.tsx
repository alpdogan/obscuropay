import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Obscurus Dashboard",
  description: "Merchant control plane for Obscurus Pay.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
