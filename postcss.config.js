    // postcss.config.js
    export default {
      plugins: {
        // Correction: Utiliser le plugin PostCSS dédié de Tailwind CSS
        '@tailwindcss/postcss': {}, // Active le plugin Tailwind CSS pour PostCSS
        autoprefixer: {}, // Ajoute automatiquement les préfixes vendeurs pour la compatibilité navigateur
      },
    };
    