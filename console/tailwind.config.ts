import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ground: "#F2F4F3",
        surface: "#FFFFFF",
        ink: { DEFAULT: "#111518", soft: "#4A5358", faint: "#8A9296" },
        rule: { DEFAULT: "#D5DAD8", strong: "#B4BCB9" },
        signal: { DEFAULT: "#0A5D46", soft: "#E3F0EB" },
        alert: { DEFAULT: "#A8341F", soft: "#F7E7E3" },
        amber: { DEFAULT: "#B5801A", soft: "#FAF0DC" },
        // CarDekho NCBD brand. Carried over from the existing Showrooms
        // Console so this reads as the same product, not a second one.
        accent: { DEFAULT: "#008075", soft: "#EAF5F5", dark: "#00665C", light: "#00A294" },
        ember: { DEFAULT: "#FF6F00", soft: "#FFF1E3", dark: "#E65C00" },
        // Data-mark colors, validated separately from the UI colors above.
        // The UI greens/navies pass contrast but sit outside the lightness
        // band and below the chroma floor for chart fills — they read muddy as
        // large areas. These are lighter, more chromatic steps of the same hues.
        viz: {
          good: "#1E9973",
          warn: "#C68A15",
          bad: "#C2452A",
          google: "#3B78D8",
          meta: "#C2662A",
        },
      },
      fontFamily: {
        display: ["Archivo", "system-ui", "sans-serif"],
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
      },
    },
  },
  plugins: [],
}
export default config
