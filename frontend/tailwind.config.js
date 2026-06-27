/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        iam: {
          bg: "#050B18",
          surface: "#071B3A",
          royal: "#0B2348",
          gold: "#D4A017",
          "gold-light": "#F6D365",
          muted: "#D9D9D9",
        },
      },
      fontFamily: {
        cinzel: ["Cinzel", "serif"],
        playfair: ["Playfair Display", "serif"],
        cormorant: ["Cormorant Garamond", "serif"],
        inter: ["Inter", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #F6D365 0%, #D4A017 100%)",
      },
      boxShadow: {
        gold: "0 0 30px rgba(212, 160, 23, 0.25)",
        glass: "0 8px 32px rgba(0, 0, 0, 0.5)",
      },
    },
  },
  plugins: [],
};
