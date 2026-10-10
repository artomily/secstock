import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SecStock Weekend Guard",
  description: "Gap-risk agent for tokenized-stock collateral on BNB Chain",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
