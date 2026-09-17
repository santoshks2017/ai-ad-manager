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
        accent: { DEFAULT: "#1B3A6B", soft: "#E6ECF5" },
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
