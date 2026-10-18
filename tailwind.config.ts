import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // A restrained palette scoped to this app. Names are semantic so
        // component code doesn't hard-code a hue.
        surface: {
          DEFAULT: "#ffffff",
          muted: "#f6f7f9",
          raised: "#ffffff",
          border: "#e4e7ec",
        },
        text: {
          DEFAULT: "#0f172a",
          muted: "#475569",
          soft: "#64748b",
          inverse: "#ffffff",
        },
        accent: {
          DEFAULT: "#4f46e5", // indigo-600
          muted: "#eef2ff",
          strong: "#3730a3",
        },
        success: {
          DEFAULT: "#16a34a",
          muted: "#dcfce7",
        },
        warning: {
          DEFAULT: "#d97706",
          muted: "#fef3c7",
        },
        locked: {
          DEFAULT: "#94a3b8",
          muted: "#f1f5f9",
        },
      },
    },
  },
  plugins: [],
};

export default config;
