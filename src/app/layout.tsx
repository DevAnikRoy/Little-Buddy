import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "Little Buddy | English, one little step at a time",
  description: "A friendly English learning companion for young children."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
