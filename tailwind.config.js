/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],

  theme: {
    extend: {
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'system-ui', 'sans-serif'],
        display: ['Sora', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
      },

      colors: {
        /*
         * HIGH PARK CONSULT
         * Primary: Deep Navy
         */
        brand: {
          50: '#f1f5fb',
          100: '#e2eaf5',
          200: '#c5d4e8',
          300: '#9bb2d1',
          400: '#6d8db8',
          500: '#315b91',
          600: '#244a7d',
          700: '#1b3b68',
          800: '#142e54',
          900: '#0d2342',
          950: '#07172f',
        },

        /*
         * HIGH PARK CONSULT
         * Secondary: Gold
         */
        accent: {
          50: '#fffaf0',
          100: '#fff3d6',
          200: '#ffe6ad',
          300: '#f9d276',
          400: '#e9b83f',
          500: '#c9972e',
          600: '#b58420',
          700: '#956b19',
          800: '#765315',
          900: '#604512',
          950: '#362507',
        },

        /*
         * Neutral / text colors
         */
        ink: {
          50: '#f7f8fa',
          100: '#eef0f4',
          200: '#dce1e8',
          300: '#c0c8d4',
          400: '#94a0b2',
          500: '#68758a',
          600: '#4e5b70',
          700: '#3c485c',
          800: '#2d3748',
          900: '#202a3a',
          950: '#111827',
        },
      },

      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },

      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },

        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(20px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },

        scaleIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.95)',
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
      },

      boxShadow: {
        'soft': '0 10px 30px rgba(13, 35, 66, 0.08)',
        'soft-lg': '0 20px 50px rgba(13, 35, 66, 0.12)',
        'gold': '0 8px 25px rgba(201, 151, 46, 0.20)',
      },

      borderRadius: {
        'xl': '0.875rem',
        '2xl': '1.25rem',
      },
    },
  },

  plugins: [],
};