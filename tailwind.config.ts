import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#fbf9f4",
        ink: "#231f1b",
        crust: "#c2410c",
        herb: "#4d7c0f",
      },
    },
  },
  plugins: [],
} satisfies Config;
