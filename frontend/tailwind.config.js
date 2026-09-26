/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        "em-sm":  "0 1px 3px 0 rgb(99 102 241 / 0.12)",
        "em-md":  "0 4px 16px -2px rgb(99 102 241 / 0.18)",
        "em-lg":  "0 10px 32px -4px rgb(99 102 241 / 0.22)",
        "tl-md":  "0 4px 16px -2px rgb(139 92 246 / 0.18)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
        "page-gradient":  "linear-gradient(135deg, #eef2ff 0%, #fafbff 50%, #f5f3ff 100%)",
      },
      animation: {
        "fade-in":  "fadeIn 0.2s ease-out",
        "slide-up": "slideUp 0.25s ease-out",
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: "translateY(8px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      },
    },
  },
  plugins: [],
};
