/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // UE5 inspired dark theme
        ue: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          text: '#c9d1d9',
          muted: '#8b949e',
          accent: '#58a6ff',
          success: '#3fb950',
          warning: '#d29922',
          error: '#f85149',
        },
        // Agent colors
        agent: {
          architect: '#58a6ff',
          developer: '#3fb950',
          blueprint: '#f0883e',
          qa: '#a371f7',
          devops: '#d29922',
          artist: '#f778ba',
        },
        // Performance theme colors (using CSS variables)
        perf: {
          primary: 'var(--color-orange-500)',
          secondary: 'var(--color-red-600)',
          light: 'var(--color-orange-400)',
          dark: 'var(--color-red-700)',
        },
        // AI theme colors
        ai: {
          primary: 'var(--color-purple-500)',
          secondary: 'var(--color-violet-600)',
          light: 'var(--color-purple-400)',
          dark: 'var(--color-violet-700)',
        },
        // Glass colors
        glass: {
          bg: 'var(--glass-bg)',
          'bg-light': 'var(--glass-bg-light)',
          'bg-dark': 'var(--glass-bg-dark)',
          border: 'var(--glass-border)',
          'border-light': 'var(--glass-border-light)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        // Gradients using CSS variables
        'gradient-performance': 'var(--gradient-performance)',
        'gradient-performance-subtle': 'var(--gradient-performance-subtle)',
        'gradient-ai': 'var(--gradient-ai)',
        'gradient-ai-subtle': 'var(--gradient-ai-subtle)',
        'gradient-success': 'var(--gradient-success)',
        'gradient-warning': 'var(--gradient-warning)',
        'gradient-error': 'var(--gradient-error)',
        'gradient-info': 'var(--gradient-info)',
        'gradient-bg-radial': 'var(--gradient-bg-radial)',
        'gradient-bg-mesh': 'var(--gradient-bg-mesh)',
      },
      boxShadow: {
        // Glow shadows using CSS variables
        'glow-orange': 'var(--shadow-glow-orange)',
        'glow-red': 'var(--shadow-glow-red)',
        'glow-purple': 'var(--shadow-glow-purple)',
        'glow-green': 'var(--shadow-glow-green)',
        'glow-blue': 'var(--shadow-glow-blue)',
        'card': 'var(--shadow-card)',
        'button': 'var(--shadow-button)',
        'button-ai': 'var(--shadow-button-ai)',
      },
      backdropBlur: {
        'glass-sm': 'var(--blur-sm)',
        'glass-md': 'var(--blur-md)',
        'glass-lg': 'var(--blur-lg)',
        'glass-xl': 'var(--blur-xl)',
      },
      borderRadius: {
        'card': 'var(--card-radius)',
      },
      spacing: {
        'card-padding': 'var(--card-padding)',
      },
      transitionDuration: {
        'fast': 'var(--duration-fast)',
        'normal': 'var(--duration-normal)',
        'slow': 'var(--duration-slow)',
        'slower': 'var(--duration-slower)',
        'slowest': 'var(--duration-slowest)',
      },
      transitionTimingFunction: {
        'bounce': 'var(--ease-bounce)',
        'elastic': 'var(--ease-elastic)',
      },
      animation: {
        'gauge-fill': 'gauge-fill var(--duration-slowest) var(--ease-out) forwards',
        'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
        'fade-in-up': 'fade-in-up 0.3s ease-out forwards',
        'bounce-in': 'bounce-in 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55) forwards',
        'shimmer': 'shimmer 2s linear infinite',
      },
      keyframes: {
        'gauge-fill': {
          'from': { strokeDashoffset: 'var(--gauge-circumference)' },
          'to': { strokeDashoffset: 'var(--gauge-offset)' },
        },
        'pulse-glow': {
          '0%, 100%': { boxShadow: '0 0 5px currentColor, 0 0 10px currentColor' },
          '50%': { boxShadow: '0 0 15px currentColor, 0 0 25px currentColor' },
        },
        'fade-in-up': {
          'from': { opacity: '0', transform: 'translateY(10px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      zIndex: {
        'dropdown': 'var(--z-dropdown)',
        'sticky': 'var(--z-sticky)',
        'fixed': 'var(--z-fixed)',
        'modal-backdrop': 'var(--z-modal-backdrop)',
        'modal': 'var(--z-modal)',
        'popover': 'var(--z-popover)',
        'tooltip': 'var(--z-tooltip)',
        'toast': 'var(--z-toast)',
        'max': 'var(--z-max)',
      },
    },
  },
  plugins: [],
}
