/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light minimalist palette (Frank Advisory)
        primary: {
          DEFAULT: '#1e1645',  // Dark indigo (from design)
          50: '#f5f5f7',
          100: '#eaeaee',
          200: '#d5d5dd',
          300: '#b0b0bf',
          400: '#8585a0',
          500: '#5a5a7d',
          600: '#3a3a5a',
          700: '#2a2a4a',
          800: '#1e1645',  // Dark indigo
          900: '#151535',
        },
        accent: {
          green: '#88aa00',  // Vivid yellow-green (from design)
          DEFAULT: '#88aa00',
        },
        surface: {
          DEFAULT: '#ffffff',  // White background
          light: '#f9f9fb',  // Light gray
          gray: '#e5e5e5',  // Medium gray (from design)
          dark: '#1e1645',  // Dark indigo for headers
        },
        text: {
          DEFAULT: '#1e1645',  // Dark indigo for body text
          light: '#5a5a7d',  // Lighter for secondary text
          muted: '#8585a0',  // Muted for tertiary text
        }
      },
      fontFamily: {
        sans: ['Satoshi', 'Inter', 'system-ui', 'sans-serif'],
        display: ['Cabinet Grotesk', 'Satoshi', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'pulse-subtle': 'pulseSubtle 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
    },
  },
  plugins: [],
}
