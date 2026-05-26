import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Claim Submission",
  description: "Multi-step claim submission with DocuSeal agreement generation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app">{children}</div>
      </body>
    </html>
  );
}
