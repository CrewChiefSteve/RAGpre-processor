/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Status colors
        success: '#10b981',  // emerald-500
        warning: '#f59e0b',  // amber-500
        error: '#ef4444',    // red-500
        processing: '#3b82f6', // blue-500

        // Source badges
        azure: '#0078d4',    // Microsoft blue
        vision: '#10a37f',   // OpenAI green
      },
    },
  },
  plugins: [],
}
