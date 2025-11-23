/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
      "./src/app/**/*.{ts,tsx}",
      "./src/components/**/*.{ts,tsx}",
    ],
    theme: {
      extend: {
        borderRadius: {
          lg: "4px",
          md: "3px",
          sm: "2px",
        },
      },
    },
    plugins: [require("tailwindcss-animate")],
  };
  