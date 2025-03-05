import type { Metadata } from "next";
import "./globals.css";
import ClientLayout from "./clientlayout";

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`antialiased`}>
        <ClientLayout />
        <div className="header p-4">
          <div className="bg-[--color-bg-light] py-2 px-8 rounded-full">
            <p className="text-[1.4em]">Interviu</p>
          </div>
        </div>
        <div
          className="px-8 py-4 flex flex-col"
        >{children}</div>
      </body>
    </html>
  );
}
