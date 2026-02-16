import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#151722",
        panel: "#0f1118",
        panelSoft: "#1a1d29",
        userBubble: "#1447e6",
        assistBubble: "#202536",
        borderSoft: "#2b3144"
      },
      boxShadow: {
        soft: "0 10px 40px rgba(0, 0, 0, 0.2)"
      }
    }
  },
  plugins: []
};

export default config;
