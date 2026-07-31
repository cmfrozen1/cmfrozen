import type { Metadata } from "next";
import { Prompt, Inter } from "next/font/google";
import "./globals.css";

const prompt = Prompt({
  variable: "--font-prompt",
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "CM Frozen - คลังสินค้าควบคุมอุณหภูมิอัจฉริยะ & โลจิสติกส์",
  description: "ผู้นำด้านคลังสินค้าแช่เย็น แช่แข็ง และการจัดการโลจิสติกส์ห่วงโซ่ความเย็น (Cold Chain) ที่ทันสมัยที่สุดในภาคเหนือ",
  keywords: ["คลังสินค้าเย็น", "ห้องเย็น เชียงใหม่", "คลังสินค้าแช่แข็ง", "Cold Storage Chiang Mai", "โลจิสติกส์ห้องเย็น", "CM Frozen"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="th"
      className={`${prompt.variable} ${inter.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-full flex flex-col bg-[#fafcff] text-slate-800 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-300">
        {children}
      </body>
    </html>
  );
}
