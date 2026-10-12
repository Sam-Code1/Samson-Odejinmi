import type { Config } from "tailwindcss";

const c = (v: string) => `rgb(var(--${v}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: { center: true },
    screens: { xs: "430px", sm: "640px", md: "768px", lg: "1024px", xl: "1280px", "2xl": "1536px" },
    extend: {
      colors: {
        canvas: c("canvas"),
        surface: c("surface"),
        elevated: c("elevated"),
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3") },
        blue: { DEFAULT: c("blue"), soft: c("blue-soft") },
        violet: { DEFAULT: c("violet"), soft: c("violet-soft") },
        warm: { DEFAULT: c("warm"), soft: c("warm-soft") },
        tint: { blue: c("tint-blue"), violet: c("tint-violet"), peach: c("tint-peach"), mint: c("tint-mint") },
        line: "rgb(var(--line) / 0.14)",
        "line-strong": "rgb(var(--line) / 0.3)",
      },
      fontFamily: { sans: ["var(--font-manrope)", "ui-sans-serif", "system-ui", "sans-serif"] },
      fontSize: {
        // Spec: Display 40/52/64, H1 32-36/40-44/48-56, H2 26-30/30-34/36-42, H3 22-24/24-28/26-32, H4 20-24
        display: ["clamp(2.5rem, 1.6rem + 2.8vw, 4rem)", { lineHeight: "1.06", letterSpacing: "-0.035em", fontWeight: "700" }],
        h1: ["clamp(2rem, 1.3rem + 2.2vw, 3.5rem)", { lineHeight: "1.08", letterSpacing: "-0.03em", fontWeight: "700" }],
        h2: ["clamp(1.625rem, 1.2rem + 1.6vw, 2.625rem)", { lineHeight: "1.12", letterSpacing: "-0.025em", fontWeight: "600" }],
        h3: ["clamp(1.375rem, 1.1rem + 1vw, 2rem)", { lineHeight: "1.2", letterSpacing: "-0.02em", fontWeight: "600" }],
        h4: ["1.25rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
        "body-lg": ["1.125rem", { lineHeight: "1.6" }],
        body: ["1rem", { lineHeight: "1.6" }],
        "body-sm": ["0.875rem", { lineHeight: "1.5" }],
        caption: ["0.8125rem", { lineHeight: "1.4" }],
        label: ["0.875rem", { lineHeight: "1.2", fontWeight: "600" }],
        meta: ["0.75rem", { lineHeight: "1.4", letterSpacing: "0.01em" }],
        // Admin scale: denser than the public site
        "admin-title": ["clamp(2rem, 1.5rem + 1.4vw, 2.75rem)", { lineHeight: "1.1", letterSpacing: "-0.03em", fontWeight: "700" }],
        "admin-section": ["1.125rem", { lineHeight: "1.3", letterSpacing: "-0.01em", fontWeight: "600" }],
      },
      maxWidth: { page: "1320px", prose: "62ch", narrow: "46ch" },
      borderRadius: { sm: "3px", DEFAULT: "6px", md: "8px", lg: "12px" },
      transitionTimingFunction: { quiet: "cubic-bezier(0.22, 1, 0.36, 1)" },
      transitionDuration: { quick: "180ms", base: "320ms", slow: "700ms" },
    },
  },
  plugins: [],
};
export default config;
