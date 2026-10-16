/** @type {import('tailwindcss').Config} */
const c = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('bg'),
        surface: c('surface'),
        surface2: c('surface-2'),
        surface3: c('surface-3'),
        line: c('line'),
        'line-strong': c('line-strong'),
        text: c('text'),
        muted: c('muted'),
        subtle: c('subtle'),
        primary: {
          DEFAULT: c('primary'),
          hover: c('primary-hover'),
          press: c('primary-press'),
          soft: c('primary-soft'),
          fg: c('on-primary'),
        },
        accent: { DEFAULT: c('accent'), soft: c('accent-soft') },
        success: { DEFAULT: c('success'), soft: c('success-soft') },
        danger: { DEFAULT: c('danger'), soft: c('danger-soft') },
        info: { DEFAULT: c('info'), soft: c('info-soft') },
        ai: { DEFAULT: c('ai'), soft: c('ai-soft') },
        focusring: c('focus'),
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Cascadia Mono', 'Consolas', 'monospace'],
      },
      fontSize: {
        label: ['11px', { lineHeight: '14px', letterSpacing: '0.08em' }],
        xs: ['12px', '16px'],
        sm: ['13px', '18px'],
        base: ['14px', '20px'],
        lg: ['17px', '24px'],
        xl: ['22px', '28px'],
        '2xl': ['28px', '34px'],
      },
      transitionTimingFunction: {
        enter: 'cubic-bezier(.2,.8,.2,1)',
        exit: 'cubic-bezier(.4,0,1,1)',
      },
      keyframes: {
        fadeUp: { '0%': { opacity: '0', transform: 'translateY(6px)' }, '100%': { opacity: '1', transform: 'none' } },
        slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'none' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(.97)' }, '100%': { opacity: '1', transform: 'none' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseDot: { '0%,100%': { opacity: '1' }, '50%': { opacity: '.35' } },
        indeterminate: { '0%': { left: '-40%', width: '40%' }, '100%': { left: '100%', width: '40%' } },
      },
      animation: {
        fadeUp: 'fadeUp 160ms cubic-bezier(.2,.8,.2,1)',
        slideIn: 'slideIn 220ms cubic-bezier(.2,.8,.2,1)',
        scaleIn: 'scaleIn 160ms cubic-bezier(.2,.8,.2,1)',
        shimmer: 'shimmer 1.4s infinite',
        pulseDot: 'pulseDot 1.2s ease-in-out infinite',
        indeterminate: 'indeterminate 1.1s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
