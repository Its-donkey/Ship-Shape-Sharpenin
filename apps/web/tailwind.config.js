//apps/web/tailwind.config.js


/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: { DEFAULT: "#FCFCFC" },
        graphite: { DEFAULT: "#1B1B1B" },
        steel: {
          DEFAULT: "#B9C2CA",
          100: "#EEF2F5",
          200: "#DCE4EA",
          300: "#C7D1DA",
          400: "#B9C2CA",
          500: "#9EABB6",
          600: "#7C8A95",
        },
        iron: { DEFAULT: "#2E3338" },
        ink: { DEFAULT: "#6B7280" },

        // 🔴 set this to the exact red in your logo
        accent: { DEFAULT: "#F6031D" },
      },
    },
  },
  plugins: [],
};
