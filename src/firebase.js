// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

let app;
let auth;
let db;
let userId; // Pour stocker l'ID de l'utilisateur

// La configuration Firebase sera chargée de manière sécurisée en fonction de l'environnement.
// 1. Pour l'environnement Canvas : via la variable globale __firebase_config.
// 2. Pour le développement local avec Vite : via les variables d'environnement (ex: VITE_APP_FIREBASE_API_KEY)
//    Ces variables DOIVENT être dans un fichier .env qui est ignoré par Git (via .gitignore).
// 3. Pour le déploiement sur Firebase Hosting : la configuration est auto-injectée.

let firebaseConfig;

// Vérifie si __firebase_config est définie (environnement Canvas/Firebase Hosting auto-injection)
if (typeof __firebase_config !== 'undefined') {
  firebaseConfig = JSON.parse(__firebase_config);
  console.log("Firebase configuré via __firebase_config (environnement sécurisé).");
} else {
  // FALLBACK pour le développement local avec Vite, en utilisant les variables d'environnement.
  // Ces variables sont définies dans un fichier .env (ex: .env.local) et NE DOIVENT PAS être commises sur GitHub.
  console.warn("ATTENTION: __firebase_config n'est pas définie. Utilisation des variables d'environnement Vite pour le développement local.");

  firebaseConfig = {
    apiKey: import.meta.env.VITE_APP_FIREBASE_API_KEY, // <-- Lit la clé depuis .env.local
    authDomain: import.meta.env.VITE_APP_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_APP_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_APP_FIREBASE_APP_ID,
  };

  // Vérification basique pour s'assurer que les variables d'env sont chargées
  if (!firebaseConfig.apiKey) {
    console.error("Erreur: Les variables d'environnement Firebase ne sont pas configurées pour le développement local. Assurez-vous d'avoir un fichier .env avec VITE_APP_FIREBASE_API_KEY, etc.");
    // Vous pouvez choisir de planter l'application ici ou de gérer une erreur visible pour l'utilisateur.
  }
}

// Initialiser Firebase SEULEMENT si la configuration est disponible
if (firebaseConfig && firebaseConfig.apiKey) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);

  // Gère l'authentification initiale (spécifique à l'environnement Canvas ou anonyme pour le local)
  const initializeAuth = async () => {
    try {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
        console.log("Authentifié avec le jeton initial Canvas.");
      } else {
        await signInAnonymously(auth);
        console.log("Authentifié anonymement pour le développement local.");
      }
      userId = auth.currentUser?.uid || crypto.randomUUID(); // Définit l'ID utilisateur
    } catch (error) {
      console.error("Erreur lors de l'authentification Firebase:", error);
      // Fallback vers l'authentification anonyme en cas d'échec du jeton personnalisé
      try {
        await signInAnonymously(auth);
        console.log("Authentifié anonymement après échec de l'authentification initiale.");
        userId = auth.currentUser?.uid || crypto.randomUUID();
      } catch (anonError) {
        console.error("Échec de l'authentification anonyme:", anonError);
        userId = crypto.randomUUID(); // Génère un ID aléatoire si rien ne fonctionne
      }
    }
  };

  initializeAuth(); // Appelle la fonction d'initialisation de l'authentification

} else {
  console.error("Firebase n'a pas pu être initialisé car la configuration est manquante ou invalide.");
  // Assurez-vous que les objets sont null si l'initialisation échoue
  app = null;
  auth = null;
  db = null;
  userId = crypto.randomUUID(); // Fallback pour userId
}

// Exporter les instances d'authentification et de base de données
export { auth, db, userId };
