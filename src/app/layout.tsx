import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CYC Atelier",
  description: "CYC Atelier 形象網站。業主可在管理後台用自然語言修改草稿，確認後再發布。",
  icons: {
    icon: [{ url: "/cyc-logo.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
