// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth'; // Importe le service d'authentification
import { getFirestore } from 'firebase/firestore'; // Importe le service de base de données Firestore

// VOTRE CONFIGURATION FIREBASE - REMPLACEZ IMPÉRATIVEMENT CES VALEURS PAR CELLES DE VOTRE PROJET !
// Vous pouvez trouver ces informations dans les paramètres de votre projet Firebase (Paramètres du projet > Vos applications > Web)
const firebaseConfig = {
  apiKey: "AIzaSyASOnEEHJyJJJ850Yl2onKAqVMy8hRz_7c", // REMPLACEZ CETTE VALEUR
  authDomain: "application-bal-des-bacheliers.firebaseapp.com", // REMPLACEZ CETTE VALEUR
  projectId: "application-bal-des-bacheliers", // REMPLACEZ CETTE VALEUR
  storageBucket: "application-bal-des-bacheliers.firebasestorage.app", // REMPLACEZ CETTE VALEUR
  messagingSenderId: "455134407550", // REMPLACEZ CETTE VALEUR
  appId: "1:455134407550:web:dd0769101909d667e8612f" // REMPLACEZ CETTE VALEUR
};

// Initialiser Firebase avec la configuration
const app = initializeApp(firebaseConfig);

// Obtenir une référence à l'authentification Firebase
const auth = getAuth(app);

// Obtenir une référence à la base de données Firestore
const db = getFirestore(app);

// Exporter les instances d'authentification et de base de données
// Ces objets 'auth' et 'db' sont ensuite importés dans d'autres fichiers (comme App.jsx)
export { auth, db };
