/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        './index.html',
        './disqualified.html',
        './qualified.html',
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Alexandria', 'system-ui', 'sans-serif'],
            },
            colors: {
                'brand-dark': '#040b14',
                'brand-darker': '#02060d',
                'brand-cyan': '#39c8ff',
                'brand-cyan-light': '#80dfff',
                'brand-gray': '#94a3b8',
                'brand-accent': '#169fd7',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
}
