// frontend/tailwind.config.cjs
// Design system tokens — Procurement Analyzer
// "Warm Enterprise" — warm stone surfaces, amber accent (Claude/OpenAI inspired)

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      colors: {
        // Brand — Warm Amber (Claude/Databricks inspired)
        brand: {
          50: '#fffbeb',
          100: '#fef3c7',
          200: '#fde68a',
          300: '#fcd34d',
          400: '#fbbf24',
          500: '#f59e0b', // Primary Amber
          600: '#d97706',
          700: '#b45309',
          800: '#92400e',
          900: '#78350f',
          950: '#451a03',
        },
        // Accent — Warm Copper
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
          950: '#431407',
        },
        // Neutrals — Smoked Clay (terracotta undertone)
        surface: {
          50: '#fdf9f7',
          100: '#f8f1ed',
          200: '#ede5df',
          300: '#ddd3cb',
          400: '#b5a99f',
          500: '#8d8076',
          600: '#6d5f55',
          700: '#574a42',
          800: '#3e332d',
          900: '#2e2520',
          950: '#231c18', // Core Background — smoked clay
        },
      },
      backgroundImage: {
        'gradient-page': 'radial-gradient(at 0% 0%, rgba(210, 120, 80, 0.07) 0, transparent 50%), radial-gradient(at 100% 100%, rgba(180, 90, 50, 0.05) 0, transparent 50%), #231c18',
        'gradient-brand': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
      },
      boxShadow: {
        card: '0 4px 20px rgba(35, 28, 24, 0.5), 0 0 0 1px rgba(253, 249, 247, 0.05)',
        'card-hover': '0 8px 32px rgba(35, 28, 24, 0.6), 0 0 0 1px rgba(253, 249, 247, 0.08)',
        'glow-brand': '0 0 20px rgba(245, 158, 11, 0.15), 0 0 6px rgba(245, 158, 11, 0.1)',
        'glow-emerald': '0 0 12px rgba(16, 185, 129, 0.1)',
      },
      borderRadius: {
        none: '0',
        sm: '4px',
        DEFAULT: '10px',
        md: '10px',
        lg: '10px',
        xl: '10px',
        '2xl': '10px',
        '3xl': '10px',
        '4xl': '10px',
        full: '9999px',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'fade-in-up': 'fadeInUp 0.5s ease-out forwards',
        shimmer: 'shimmer 2.5s linear infinite',
        'prism-shift': 'prismShift 3s ease-in-out infinite',
        'orbital-pulse': 'orbitalPulse 2s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.35s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-out-right': 'slideOutRight 0.28s cubic-bezier(0.4, 0, 0.2, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideInRight: {
          from: { transform: 'translateX(100%)', opacity: '0.5' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        slideOutRight: {
          from: { transform: 'translateX(0)', opacity: '1' },
          to: { transform: 'translateX(100%)', opacity: '0' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        prismShift: {
          '0%': { backgroundPosition: '-200% 0' },
          '50%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        },
        orbitalPulse: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.7' },
          '50%': { transform: 'scale(1.15)', opacity: '1' },
        },
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
