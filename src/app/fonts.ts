import { Geist_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import { cn } from "@/lib/utils";

/**
 * Fola Academy typefaces (Brand Guidelines §08), all SIL OFL on Google Fonts, self-hosted by next/font:
 *   Schibsted Grotesk: display, headings, UI and body
 *   Newsreader:        long reading, books and quotes
 *   Geist Mono:        labels, captions, code and numbers
 * Loaded only by Academy layouts (inside .fa-root), so the main Samson Odejinmi site keeps its own type.
 */
const schibsted = Schibsted_Grotesk({ subsets: ["latin"], display: "swap", variable: "--font-fa-sans", weight: ["400", "500", "600", "700", "800", "900"] });
const newsreader = Newsreader({ subsets: ["latin"], display: "swap", variable: "--font-fa-serif", style: ["normal", "italic"], weight: ["400", "500", "600"] });
const geistMono = Geist_Mono({ subsets: ["latin"], display: "swap", variable: "--font-fa-mono", weight: ["400", "500", "600"] });

/** Put on the outermost element of every Academy surface. */
export const academyRoot = (className?: string) => cn("fa-root", schibsted.variable, newsreader.variable, geistMono.variable, className);

/** Main website: its own type (Manrope + Instrument Serif, from the root layout) plus the shared Geist Mono labels. */
export const studioRoot = (className?: string) => cn("st-root", geistMono.variable, className);

/** Admin: the Fola Academy type (Schibsted Grotesk + Geist Mono) on its own quiet control-room palette. */
export const adminRoot = (className?: string) => cn("ad-root", schibsted.variable, geistMono.variable, className);
