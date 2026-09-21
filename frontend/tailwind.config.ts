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
        background: "var(--background)",
        card: "var(--card)",
        primary: "var(--primary)",
        secondary: "var(--secondary)",
        warning: "var(--warning)",
        text: {
          primary: "var(--text-primary)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      borderRadius: {
        sm: "0.125rem",
        md: "0.375rem",
        lg: "0.5rem",
      },
      dropShadow: {
        "severe-sm": "0 2px 2px rgba(0, 0, 0, 0.8)",
        "severe-md": "0 4px 6px rgba(0, 0, 0, 0.9)",
        "severe-lg": "0 10px 15px rgba(0, 0, 0, 1)",
        "sharp-glow": "0 0 10px rgba(255, 59, 59, 0.5)",
      },
    },
  },
  plugins: [],
};
export default config;
