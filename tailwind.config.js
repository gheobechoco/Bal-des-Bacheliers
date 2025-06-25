// tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  // Le chemin de vos fichiers où Tailwind doit scanner les classes CSS
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}", // Ceci couvre tous les fichiers .js, .ts, .jsx, .tsx dans le dossier src et ses sous-dossiers
  ],
  theme: {
    extend: {
        // Optionnel: Définissez des polices personnalisées si vous les utilisez, par exemple 'Inter'
        fontFamily: {
            inter: ['Inter', 'sans-serif'],
        },
    },
  },
  plugins: [],
}
