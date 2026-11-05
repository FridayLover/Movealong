import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#9a3412", dark: "#7c2d12", light: "#fff7ed" },
        secondary: { DEFAULT: "#b45309", light: "#fef3c7" },
        surface: "#fffbf5",
        cream: "#fff7ed",
        ink: "#1c1917",
        muted: "#78716c",
        line: "#e7e5e4",
      },
      borderRadius: { xl: "1rem", "2xl": "1.25rem" },
      boxShadow: { card: "0 8px 30px rgba(120,53,15,0.08)", soft: "0 4px 20px rgba(120,53,15,0.05)" },
    },
  },
  plugins: [],
};
export default config;
