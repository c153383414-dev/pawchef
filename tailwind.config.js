/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        serif: ['Playfair Display', 'Georgia', 'serif'],
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
      },
      colors: {
        cream: '#F7F3EC',
        'warm-white': '#FDFAF5',
        ink: '#1C1A16',
        sage: '#7A9E7E',
        'sage-light': '#EBF2EC',
        amber: '#C8813A',
        'amber-light': '#FBF0E4',
        rose: '#C45C5C',
        'rose-light': '#FAE8E8',
        gold: '#D4A843',
      },
      animation: {
        'fade-up': 'fadeUp 0.6s ease both',
        'marquee': 'marquee 20s linear infinite',
      },
      keyframes: {
        fadeUp: {
          'from': { opacity: '0', transform: 'translateY(20px)' },
          'to': { opacity: '1', transform: 'none' },
        },
        marquee: {
          'from': { transform: 'translateX(0)' },
          'to': { transform: 'translateX(-50%)' },
        },
      },
    },
  },
  plugins: [],
}
