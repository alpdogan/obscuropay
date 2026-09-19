import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Obscurus Checkout",
  description: "Prove you paid. Not who you are.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
