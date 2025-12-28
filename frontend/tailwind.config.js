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
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
