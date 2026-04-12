import type { Config } from "tailwindcss"

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3faf7",
          100: "#d9f1e2",
          200: "#b2e5c1",
          300: "#7fd39a",
          400: "#4fb871",
          500: "#2f944e",
          600: "#266f3f",
          700: "#1f5532",
          800: "#1a4328",
          900: "#14321f",
        },
      },
    },
  },
  plugins: [],
}

export default config
