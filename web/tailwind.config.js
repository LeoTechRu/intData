module.exports = {
  content: [
    "./templates/**/*.html",
    "./static/js/**/*.js",
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent1: "#64c6a9",
        accent2: "#cfa0e9"
      }
    }
  },
  plugins: []
};
