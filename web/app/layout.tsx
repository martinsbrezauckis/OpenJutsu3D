import { Inter } from "next/font/google";
import "./studio.css";

// Inter, as in Comfy-Org/comfy-openjutsu (the visual system this app follows).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata = {
  title: "Open 3D Jutsu",
  description: "Describe a place, watch it get built in 3D, pick a camera move, get a photoreal shot. Comfy Router + Comfy SDK + LTX-2.5.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={inter.variable}><body>{children}</body></html>;
}
