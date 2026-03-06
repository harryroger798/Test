/** @type {import('tailwindcss').Config} */
export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx,js,jsx}"],
  theme: {
  	extend: {
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		colors: {
  			accent: '#FF4500',
  			'accent-hover': '#E63E00',
  			dark: '#0A0A0A',
  			'dark-card': '#111111',
  			'dark-border': '#1A1A1A',
  			light: '#F5F5F5',
  			'light-card': '#FFFFFF',
  		},
  		fontFamily: {
  			display: ['Inter', 'system-ui', 'sans-serif'],
  			mono: ['JetBrains Mono', 'monospace'],
  		},
  		animation: {
  			'marquee': 'marquee 30s linear infinite',
  			'marquee-reverse': 'marquee-reverse 30s linear infinite',
  			'float': 'float 6s ease-in-out infinite',
  			'float-delayed': 'float 6s ease-in-out infinite 2s',
  			'pulse-glow': 'pulse-glow 3s ease-in-out infinite',
  		},
  		keyframes: {
  			marquee: {
  				'0%': { transform: 'translateX(0%)' },
  				'100%': { transform: 'translateX(-50%)' },
  			},
  			'marquee-reverse': {
  				'0%': { transform: 'translateX(-50%)' },
  				'100%': { transform: 'translateX(0%)' },
  			},
  			float: {
  				'0%, 100%': { transform: 'translateY(0px)' },
  				'50%': { transform: 'translateY(-20px)' },
  			},
  			'pulse-glow': {
  				'0%, 100%': { boxShadow: '0 0 20px rgba(255,69,0,0.3)' },
  				'50%': { boxShadow: '0 0 40px rgba(255,69,0,0.6)' },
  			},
  		},
  	}
  },
  plugins: [import("tailwindcss-animate")],
}

