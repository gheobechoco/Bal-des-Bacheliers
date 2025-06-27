import React, { useState, useEffect } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'firebase/auth';
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from './firebase'; // Assurez-vous que './firebase' pointe correctement vers src/firebase.js

function App() {
  const [user, setUser] = useState(null); // Utilisateur Firebase authentifié
  const [currentView, setCurrentView] = useState('auth'); // 'auth', 'login', 'register', 'userInfoForm', 'fullForm', 'paymentStatusView'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState(''); // Pour l'entrée utilisateur lors de la connexion
  const [generatedPassword, setGeneratedPassword] = useState(''); // Pour le mot de passe auto-généré lors de l'inscription
  const [authError, setAuthError] = useState(''); // Erreurs liées à l'authentification

  // État pour la première partie du formulaire (informations de base de l'élève)
  const [userInfoFormData, setUserInfoFormData] = useState({
    nom: '',
    prenom: '',
    classe: '',
    telephone: '',
    email: '', // Sera pré-rempli par l'email de l'utilisateur authentifié
  });

  // État pour la deuxième partie du formulaire (détails du billet et paiement)
  const [fullFormData, setFullFormData] = useState({
    statut: 'Interne',
    inviteExterne: '',
    typeBillet: '',
    transactionId: '',
    accord: false,
    remarques: '',
  });

  // Nouveau état pour le statut de vérification du paiement
  // 'not_submitted', 'pending', 'confirmed', 'rejected'
  const [paymentVerificationStatus, setPaymentVerificationStatus] = useState('not_submitted');


  // Prix des billets
  const prixInterne = 10000; // F CFA
  const prixExterne = 15000; // F CFA
  const [montantPayer, setMontantPayer] = useState(0);

  // URL du billet d'invitation PDF
  const INVITATION_PDF_URL = 'https://drive.google.com/file/d/1ulbXhIuLIOqfHHLNRnBVPTN6XKwpxBFt/view?usp=drive_link';


  // Génère un mot de passe aléatoire robuste
  const generateRandomPassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
    let password = '';
    for (let i = 0; i < 12; i++) { // Longueur de 12 caractères
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Stocke le mot de passe généré dans le localStorage
  const savePasswordToLocalStorage = (userEmail, pwd) => {
    try {
      const storedPasswords = JSON.parse(localStorage.getItem('userPasswords')) || {};
      storedPasswords[userEmail] = pwd;
      localStorage.setItem('userPasswords', JSON.stringify(storedPasswords));
      console.log('Mot de passe sauvegardé dans le localStorage.');
    } catch (e) {
      console.error('Erreur lors de la sauvegarde du mot de passe dans le localStorage:', e);
      const errorMessage = 'ATTENTION : Le mot de passe généré n\'a pas pu être sauvegardé automatiquement dans votre navigateur. Veuillez le noter MANUELLEMENT.';
      console.warn(errorMessage);
    }
  };

  // Récupère le mot de passe depuis le localStorage
  const getPasswordFromLocalStorage = (userEmail) => {
    try {
      const storedPasswords = JSON.parse(localStorage.getItem('userPasswords')) || {};
      return storedPasswords[userEmail] || '';
    } catch (e) {
      console.error('Erreur lors de la récupération du mot de passe depuis le localStorage:', e);
      return '';
    }
  };

  // Gère les changements dans les champs d'authentification (email)
  const handleChangeAuth = (e) => {
    setEmail(e.target.value);
    setAuthError('');
  };

  // Gère les changements dans le champ mot de passe pour la connexion
  const handleChangePassword = (e) => {
    setPassword(e.target.value);
    setAuthError('');
  };

  // Inscription d'un nouvel utilisateur avec mot de passe généré
  const handleRegister = async (e) => {
    e.preventDefault();
    setAuthError('');

    if (!email) {
      setAuthError('Veuillez entrer une adresse e-mail.');
      return;
    }

    const newPassword = generateRandomPassword();
    setGeneratedPassword(newPassword); // Stocke le mot de passe généré pour l'afficher

    try {
      await createUserWithEmailAndPassword(auth, email, newPassword);
      savePasswordToLocalStorage(email, newPassword); // Sauvegarde dans le localStorage

      console.log(`Inscription réussie ! Votre mot de passe généré est : ${newPassword}`);
      console.warn("IMPORTANT : Veuillez le noter précieusement. Pour votre sécurité, il est recommandé de ne pas stocker les mots de passe dans le navigateur.");
      alert(`Inscription réussie ! Votre mot de passe généré est : ${newPassword}\n\nIMPORTANT : Veuillez le noter précieusement. Pour votre sécurité, il est recommandé de ne pas stocker les mots de passe dans le navigateur.`);
      // L'observateur onAuthStateChanged (ci-dessous) gérera la redirection vers le formulaire
    } catch (error) {
        console.error("Erreur d'inscription:", error);
        if (error.code === 'auth/email-already-in-use') {
            setAuthError('Cette adresse e-mail est déjà utilisée. Veuillez vous connecter ou utiliser une autre adresse.');
        } else if (error.code === 'auth/weak-password') {
            setAuthError('Le mot de passe doit contenir au moins 6 caractères.');
        } else if (error.code === 'auth/invalid-email') {
            setAuthError('Adresse e-mail invalide.');
        } else {
            setAuthError(`Erreur lors de l'inscription: ${error.message}`);
        }
    }
  };

  // Connexion d'un utilisateur existant
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!email || !password) {
      setAuthError('Veuillez entrer votre e-mail et votre mot de passe.');
      return;
    }
    try {
      await signInWithEmailAndPassword(auth, email, password);
      savePasswordToLocalStorage(email, password); // Sauvegarde le mot de passe saisi (pour la persistance si désirée)
      // L'observateur onAuthStateChanged gérera la redirection vers le formulaire
    } catch (error) {
        console.error("Erreur de connexion:", error);
        if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
            setAuthError('Identifiants invalides. Veuillez vérifier votre e-mail et mot de passe.');
        } else {
            setAuthError(`Erreur lors de la connexion: ${error.message}`);
        }
    }
  };

  // Déconnexion de l'utilisateur
  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setEmail('');
    setPassword('');
    setGeneratedPassword('');
    setCurrentView('auth'); // Retourne à l'écran d'authentification
    setUserInfoFormData({ nom: '', prenom: '', classe: '', telephone: '', email: '' });
    setFullFormData({ statut: 'Interne', inviteExterne: '', typeBillet: '', transactionId: '', accord: false, remarques: '' });
    setPaymentVerificationStatus('not_submitted'); // Réinitialise le statut de paiement
  };

  // Observateur d'état d'authentification Firebase
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setUserInfoFormData(prevData => ({ ...prevData, email: currentUser.email }));

        const userDocRef = doc(db, 'inscriptions', currentUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          setUserInfoFormData({
            nom: data.nom || '',
            prenom: data.prenom || '',
            classe: data.classe || '',
            telephone: data.telephone || '',
            email: currentUser.email,
          });
          setFullFormData({
            statut: data.statutEleve || 'Interne',
            inviteExterne: data.inviteExterne || '',
            typeBillet: data.typeBillet || '',
            transactionId: data.transactionId || '',
            accord: data.accord || false,
            remarques: data.remarques || '',
          });

          // Charge le statut de paiement depuis Firestore
          setPaymentVerificationStatus(data.paymentStatus || 'not_submitted');

          // Redirection basée sur le statut de paiement
          if (data.paymentStatus === 'confirmed' || data.paymentStatus === 'pending' || data.paymentStatus === 'rejected') {
            setCurrentView('paymentStatusView');
          } else {
            setCurrentView('userInfoForm');
            console.log('Vos informations précédentes ont été chargées. Vous pouvez les modifier ou compléter le formulaire.');
            alert('Vos informations précédentes ont été chargées. Vous pouvez les modifier ou compléter le formulaire.');
          }
        } else {
          setCurrentView('userInfoForm');
        }
      } else {
        setUser(null);
        setCurrentView('auth');
      }
    });
    return () => unsubscribe();
  }, []);

  // Effet pour pré-remplir le champ de mot de passe lors du passage à la vue de connexion
  useEffect(() => {
    if (currentView === 'login') {
      const storedPwd = getPasswordFromLocalStorage(email);
      if (storedPwd) {
        setPassword(storedPwd);
      }
    }
  }, [currentView, email]);

  // Gère les changements dans la première partie du formulaire (userInfoForm)
  const handleChangeUserInfoForm = (e) => {
    const { name, value } = e.target;
    setUserInfoFormData(prevData => ({
      ...prevData,
      [name]: value,
    }));
  };

  // Gère les changements dans la deuxième partie du formulaire (fullFormData)
  const handleChangeFullForm = (e) => {
    const { name, value, type, checked } = e.target;
    setFullFormData(prevData => ({
      ...prevData,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  // Effet pour calculer le montant à payer en fonction du statut (Interne/Externe)
  useEffect(() => {
    let selectedTypeBillet = '';
    let calculatedMontant = 0;

    if (fullFormData.statut === 'Interne') {
      selectedTypeBillet = `Billet Interne (Élève Raponda Walker) - ${prixInterne.toLocaleString('fr-FR')} F CFA`;
      calculatedMontant = prixInterne;
    } else {
      selectedTypeBillet = `Billet Externe - ${prixExterne.toLocaleString('fr-FR')} F CFA`;
      calculatedMontant = prixExterne;
    }

    setFullFormData(prevData => ({
      ...prevData,
      typeBillet: selectedTypeBillet,
    }));
    setMontantPayer(calculatedMontant);

  }, [fullFormData.statut]);

  // Soumission de la première partie du formulaire (informations de l'utilisateur)
  const handleSubmitUserInfoForm = async (e) => {
    e.preventDefault();
    let isValid = true;
    const errors = {};

    // Vérifier l'utilisateur et son email au début de la soumission
    if (!user || !user.email) {
        alert("Une erreur d'authentification est survenue. Veuillez vous reconnecter.");
        setCurrentView('auth');
        return;
    }

    // Mise à jour de l'email dans userInfoFormData avec l'email de l'utilisateur authentifié
    // Ceci est crucial pour s'assurer que la valeur est à jour au moment de la soumission.
    const submissionEmail = user.email;
    setUserInfoFormData(prevData => ({ ...prevData, email: submissionEmail }));


    const requiredFields = ['nom', 'prenom', 'classe', 'telephone'];
    requiredFields.forEach(field => {
      if (!userInfoFormData[field] || (typeof userInfoFormData[field] === 'string' && !userInfoFormData[field].trim())) {
        isValid = false;
        errors[field] = 'Ce champ est obligatoire.';
      }
    });

    // Validation de l'email directement depuis user.email
    if (!submissionEmail || !submissionEmail.trim()) {
        isValid = false;
        errors.email = 'L\'adresse e-mail de l\'utilisateur connecté est manquante.';
    }

    if (!/^\d{7,9}$/.test(userInfoFormData.telephone.trim())) {
      isValid = false;
      errors.telephone = 'Veuillez entrer un numéro de téléphone valide (7 à 9 chiffres).';
    }

    if (!isValid) {
      let errorMessage = 'Veuillez corriger les erreurs suivantes :\n';
      Object.values(errors).forEach(msg => {
        errorMessage += `- ${msg}\n`;
      });
      console.warn(errorMessage);
      alert(errorMessage);
      return;
    }

    // user est déjà vérifié au début de la fonction
    const userDocRef = doc(db, 'inscriptions', user.uid);
    try {
      await setDoc(userDocRef, {
        nom: userInfoFormData.nom,
        prenom: userInfoFormData.prenom,
        classe: userInfoFormData.classe,
        telephone: userInfoFormData.telephone,
        email: submissionEmail, // Utiliser l'email directement de l'utilisateur authentifié
        userId: user.uid,
        status: 'partially_registered', // Marque comme partiellement enregistré
        lastUpdated: new Date().toISOString()
      }, { merge: true });
      console.log('Informations personnelles sauvegardées !');
      alert('Informations personnelles sauvegardées !');
      setCurrentView('fullForm');
    } catch (error) {
      console.error("Erreur lors de l'enregistrement des informations personnelles:", error);
      alert("Erreur lors de la sauvegarde de vos informations. Veuillez réessayer.");
    }
  };

  // Soumission du formulaire complet (seconde étape, après userInfoForm)
  const handleSubmitFullForm = async (e) => {
    e.preventDefault();

    let isValid = true;
    const errors = {};

    const requiredFullFormFields = ['statut', 'typeBillet', 'transactionId', 'accord'];
    requiredFullFormFields.forEach(field => {
      if (!fullFormData[field] || (typeof fullFormData[field] === 'string' && !fullFormData[field].trim())) {
        isValid = false;
        errors[field] = `Le champ '${field}' est obligatoire.`;
      }
    });

    if (!fullFormData.accord) {
      isValid = false;
      errors.accord = 'Vous devez accepter les termes et conditions.';
    }

    if (!isValid) {
      let errorMessage = 'Veuillez corriger les erreurs suivantes :\n';
      Object.values(errors).forEach(msg => {
        errorMessage += `- ${msg}\n`;
      });
      console.warn(errorMessage);
      alert(errorMessage);
      return;
    }

    if (user) {
      const userDocRef = doc(db, 'inscriptions', user.uid);
      try {
        await updateDoc(userDocRef, {
          statutEleve: fullFormData.statut,
          inviteExterne: fullFormData.statut === 'Externe' ? fullFormData.inviteExterne : null,
          typeBillet: fullFormData.typeBillet,
          montantPaye: montantPayer,
          transactionId: fullFormData.transactionId,
          accord: fullFormData.accord,
          remarques: fullFormData.remarques,
          status: 'completed_registration', // Marque l'inscription comme complète
          paymentStatus: 'pending', // Définit le statut de paiement sur 'pending'
          lastUpdated: new Date().toISOString()
        });
        alert('Votre demande de paiement a été soumise. Nous vérifierons votre transaction manuellement.');
        console.log('Données finales du formulaire enregistrées dans Firestore avec statut de paiement en attente.');
        setPaymentVerificationStatus('pending'); // Met à jour l'état local
        setCurrentView('paymentStatusView'); // Redirige vers la vue du statut de paiement
      } catch (error) {
        console.error("Erreur lors de l'enregistrement du formulaire complet:", error);
        alert("Erreur lors de la sauvegarde du formulaire complet. Veuillez réessayer.");
      }
    } else {
      alert("Une erreur est survenue. Veuillez vous reconnecter.");
      setCurrentView('auth');
    }
  };

  // Fonction de simulation de confirmation/rejet de paiement (pour le développement)
  // ATTENTION: Ces fonctions sont uniquement pour les tests et DOIVENT ÊTRE SUPPRIMÉES en production.
  const simulatePaymentUpdate = async (status) => {
    if (user) {
      const userDocRef = doc(db, 'inscriptions', user.uid);
      try {
        await updateDoc(userDocRef, {
          paymentStatus: status,
          lastUpdated: new Date().toISOString()
        });
        setPaymentVerificationStatus(status);
        console.log(`Statut de paiement simulé mis à jour à : ${status}`);
        // Pas besoin d'alerte ici
      } catch (error) {
        console.error("Erreur lors de la mise à jour simulée du paiement:", error);
        alert("Erreur lors de la simulation de la mise à jour du paiement.");
      }
    }
  };


  // --- Rendu conditionnel des vues ---

  // Vue d'authentification (choix Connexion/Inscription)
  if (currentView === 'auth') {
    return (
      <div className="min-h-screen flex justify-center items-center py-8 bg-gray-950 text-gray-100 font-inter">
        <div className="container max-w-md w-full p-8 rounded-xl shadow-lg bg-gray-900 text-center">
          <h2 className="text-3xl font-bold text-amber-400 mb-6">Bienvenue au Bal des Bacheliers !</h2>
          <p className="text-gray-300 mb-8">Veuillez vous connecter ou vous inscrire pour continuer.</p>

          {authError && (
            <div className="bg-red-900 text-red-200 p-3 rounded-md mb-4">
              {authError}
            </div>
          )}

          <div className="flex flex-col space-y-4">
            <button
              onClick={() => setCurrentView('login')}
              className="w-full py-3 bg-amber-400 text-gray-900 font-bold text-lg rounded-lg shadow-md hover:bg-amber-500 transition duration-200"
            >
              Se Connecter
            </button>
            <button
              onClick={() => setCurrentView('register')}
              className="w-full py-3 bg-gray-700 text-gray-100 font-bold text-lg rounded-lg shadow-md hover:bg-gray-600 transition duration-200"
            >
              S'inscrire
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Vue de connexion
  if (currentView === 'login') {
    return (
      <div className="min-h-screen flex justify-center items-center py-8 bg-gray-950 text-gray-100 font-inter">
        <div className="container max-w-md w-full p-8 rounded-xl shadow-lg bg-gray-900">
          <h2 className="text-3xl font-bold text-amber-400 mb-6 text-center">Connexion</h2>
          <p className="text-gray-300 mb-4 text-center">Connectez-vous pour accéder au formulaire.</p>

          {authError && (
            <div className="bg-red-900 text-red-200 p-3 rounded-md mb-4">
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="loginEmail" className="block text-gray-200 font-bold mb-2">Email :</label>
              <input
                type="email"
                id="loginEmail"
                name="email"
                value={email}
                onChange={handleChangeAuth}
                onBlur={(e) => { setEmail(e.target.value); setPassword(getPasswordFromLocalStorage(e.target.value)); }}
                required
                className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <div>
              <label htmlFor="loginPassword" className="block text-gray-200 font-bold mb-2">Mot de passe :</label>
              <input
                type="password"
                id="loginPassword"
                name="password"
                value={password}
                onChange={handleChangePassword}
                required
                className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <button type="submit" className="w-full py-3 bg-amber-400 text-gray-900 font-bold text-lg rounded-lg shadow-md hover:bg-amber-500 transition duration-200">
              Se Connecter
            </button>
          </form>
          <button
            onClick={() => setCurrentView('auth')}
            className="mt-4 w-full py-2 text-gray-400 hover:text-gray-200 transition duration-200"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Vue d'inscription
  if (currentView === 'register') {
    return (
      <div className="min-h-screen flex justify-center items-center py-8 bg-gray-950 text-gray-100 font-inter">
        <div className="container max-w-md w-full p-8 rounded-xl shadow-lg bg-gray-900">
          <h2 className="text-3xl font-bold text-amber-400 mb-6 text-center">Inscription</h2>
          <p className="text-gray-300 mb-4 text-center">Créez un compte pour vous inscrire au bal.</p>

          {authError && (
            <div className="bg-red-900 text-red-200 p-3 rounded-md mb-4">
              {authError}
            </div>
          )}
           {generatedPassword && ( // Affiche le mot de passe généré
            <div className="bg-emerald-900 text-emerald-200 p-3 rounded-md mb-4 text-center">
              Votre mot de passe généré: <strong className="break-all">{generatedPassword}</strong><br/>
              <span className="text-yellow-300 text-sm">IMPORTANT: Notez-le précieusement.</span>
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label htmlFor="registerEmail" className="block text-gray-200 font-bold mb-2">Email :</label>
              <input
                type="email"
                id="registerEmail"
                name="email"
                value={email}
                onChange={handleChangeAuth}
                required
                className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"
              />
            </div>
            <button type="submit" className="w-full py-3 bg-amber-400 text-gray-900 font-bold text-lg rounded-lg shadow-md hover:bg-amber-500 transition duration-200">
              S'inscrire (Générer un Mot de Passe)
            </button>
          </form>
          <button
            onClick={() => setCurrentView('auth')}
            className="mt-4 w-full py-2 text-gray-400 hover:text-gray-200 transition duration-200"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  // Vue du formulaire des informations personnelles (première partie du formulaire principal)
  if (currentView === 'userInfoForm') {
    return (
      <div className="min-h-screen flex justify-center items-start py-8 bg-gray-950 text-gray-100 font-inter">
        <div className="container max-w-2xl w-full p-8 rounded-xl shadow-lg bg-gray-900 relative overflow-visible">
          {/* Bouton de déconnexion */}
          {user && (
            <div className="text-right mb-4">
              <span className="text-gray-400 text-sm mr-2">Connecté(e) : {user.email}</span>
              <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition duration-200">
                Déconnexion
              </button>
            </div>
          )}

          <header className="text-center mb-8 relative pb-5">
            <img src="https://placehold.co/80x80/FFD700/000?text=🎓" alt="Chapeau de Diplômé" className="mx-auto mb-4 w-20 h-20 filter drop-shadow-[0_0_5px_rgba(255,215,0,0.7)]" />
            <h1 className="text-amber-400 text-4xl font-bold mb-1 uppercase tracking-wider">LE BAL DES BACHELIERS</h1>
            <h2 className="text-gray-200 text-lg font-normal mt-0 uppercase tracking-wide">CLÔTURONS LA FIN D'ANNÉE 2K25</h2>
          </header>

          <p className="text-center mb-8 text-gray-300 text-base leading-relaxed">
            Préparez-vous pour une nuit inoubliable ! Veuillez remplir vos informations personnelles.
          </p>

          <form onSubmit={handleSubmitUserInfoForm} className="space-y-6">
            <fieldset className="border border-gray-600 rounded-lg p-6 relative">
              <legend className="text-amber-400 text-xl font-bold px-2 bg-gray-900 rounded-md absolute -top-4 left-5">Informations Personnelles</legend>

              <div className="mb-4">
                <label htmlFor="nom" className="block text-gray-200 font-bold mb-2">Nom Complet :</label>
                <input type="text" id="nom" name="nom" value={userInfoFormData.nom} onChange={handleChangeUserInfoForm} required
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none" />
              </div>

              <div className="mb-4">
                <label htmlFor="prenom" className="block text-gray-200 font-bold mb-2">Prénom Complet :</label>
                <input type="text" id="prenom" name="prenom" value={userInfoFormData.prenom} onChange={handleChangeUserInfoForm} required
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none" />
              </div>

              <div className="mb-4">
                <label htmlFor="classe" className="block text-gray-200 font-bold mb-2">Classe/Série :</label>
                <select id="classe" name="classe" value={userInfoFormData.classe} onChange={handleChangeUserInfoForm} required
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none">
                  <option value="">Sélectionnez votre classe/série</option>
                  <option value="S">Scientifique (S)</option>
                  <option value="L">Littéraire (L)</option>
                  <option value="ES">Économique & Social (ES)</option>
                  <option value="Autre">Autre</option>
                </select>
              </div>

              <div className="mb-4">
                <label htmlFor="telephone" className="block text-gray-200 font-bold mb-2">Numéro de Téléphone (Mobile Money) :</label>
                <input type="tel" id="telephone" name="telephone" value={userInfoFormData.telephone} onChange={handleChangeUserInfoForm} placeholder="Ex: 077123456" required
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none" />
                <small className="block mt-1 text-gray-400 text-sm">Ce numéro est crucial pour la vérification de votre paiement Mobile Money.</small>
              </div>

              <div className="mb-4">
                <label htmlFor="email" className="block text-gray-200 font-bold mb-2">Adresse Email :</label>
                {/* Le champ email est en lecture seule, sa valeur vient de l'authentification */}
                <input type="email" id="email" name="email" value={userInfoFormData.email} readOnly disabled
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-700 text-gray-100 cursor-not-allowed opacity-80" />
                <small className="block mt-1 text-gray-400 text-sm">Cet e-mail est celui de votre compte. Il ne peut pas être modifié ici.</small>
              </div>
            </fieldset>

            <button type="submit" className="w-full py-4 bg-amber-400 text-gray-900 font-bold text-xl uppercase tracking-wider rounded-lg shadow-lg hover:bg-amber-500 transform hover:-translate-y-1 transition duration-200 ease-in-out">
              Continuer
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Vue du formulaire complet (après informations personnelles)
  if (currentView === 'fullForm') {
    return (
      <div className="min-h-screen flex justify-center items-start py-8 bg-gray-950 text-gray-100 font-inter">
        <div className="container max-w-2xl w-full p-8 rounded-xl shadow-lg bg-gray-900 relative overflow-visible">
          {/* Bouton de déconnexion */}
          {user && (
            <div className="text-right mb-4">
              <span className="text-gray-400 text-sm mr-2">Connecté(e) : {user.email}</span>
              <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition duration-200">
                Déconnexion
              </button>
            </div>
          )}

          <header className="text-center mb-8 relative pb-5">
            <img src="https://placehold.co/80x80/FFD700/000?text=🎓" alt="Chapeau de Diplômé" className="mx-auto mb-4 w-20 h-20 filter drop-shadow-[0_0_5px_rgba(255,215,0,0.7)]" />
            <h1 className="text-amber-400 text-4xl font-bold mb-1 uppercase tracking-wider">LE BAL DES BACHELIERS</h1>
            <h2 className="text-gray-200 text-lg font-normal mt-0 uppercase tracking-wide">CLÔTURONS LA FIN D'ANNÉE 2K25</h2>
          </header>

          <p className="text-center mb-8 text-gray-300 text-base leading-relaxed">
            Presque terminé ! Veuillez choisir votre type de billet et fournir les détails de paiement.
          </p>

          <form onSubmit={handleSubmitFullForm} className="space-y-6">
            {/* Section Choix du Billet & Paiement (Manuel) */}
            <fieldset className="border border-gray-600 rounded-lg p-6 relative">
              <legend className="text-amber-400 text-xl font-bold px-2 bg-gray-900 rounded-md absolute -top-4 left-5">Choix du Billet & Paiement</legend>

              <div className="mb-4">
                <label className="block text-gray-200 font-bold mb-2">Statut :</label>
                <div className="flex space-x-6">
                  <div className="flex items-center">
                    <input type="radio" id="statutInterne" name="statut" value="Interne" checked={fullFormData.statut === 'Interne'} onChange={handleChangeFullForm} required
                      className="mr-2 text-amber-400 bg-gray-800 border-gray-700 focus:ring-amber-500 rounded-full" />
                    <label htmlFor="statutInterne" className="text-gray-200">Interne (Élève Raponda Walker)</label>
                  </div>
                  <div className="flex items-center">
                    <input type="radio" id="statutExterne" name="statut" value="Externe" checked={fullFormData.statut === 'Externe'} onChange={handleChangeFullForm} required
                      className="mr-2 text-amber-400 bg-gray-800 border-gray-700 focus:ring-amber-500 rounded-full" />
                    <label htmlFor="statutExterne" className="text-gray-200">Externe (Accompagnant/Autre)</label>
                  </div>
                </div>
              </div>

              {fullFormData.statut === 'Externe' && (
                <div className="mb-4">
                  <label htmlFor="inviteExterne" className="block text-gray-200 font-bold mb-2">Nom de l'élève de Raponda Walker qui vous invite (si Externe) :</label>
                  <input type="text" id="inviteExterne" name="inviteExterne" value={fullFormData.inviteExterne} onChange={handleChangeFullForm}
                    className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none" />
                </div>
              )}

              <div className="mb-4">
                <label htmlFor="typeBillet" className="block text-gray-200 font-bold mb-2">Type de Billet :</label>
                <input type="text" id="typeBillet" name="typeBillet" value={fullFormData.typeBillet} readOnly disabled
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-700 text-gray-100 cursor-not-allowed opacity-80" />
              </div>

              <div className="mb-4">
                <label htmlFor="montantPayer" className="block text-gray-200 font-bold mb-2">Montant à Payer :</label>
                <input type="text" id="montantPayer" name="montantPayer" value={`${montantPayer.toLocaleString('fr-FR')} F CFA`} readOnly disabled
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-700 text-gray-100 cursor-not-allowed opacity-80" />
              </div>

              <div className="bg-gray-800 p-4 rounded-lg mb-6 border-l-4 border-amber-400">
                <p className="mb-2 text-gray-300">
                  Veuillez effectuer votre paiement via Mobile Money (Airtel Money / Moov Money) au numéro suivant :
                  <br /><strong className="text-amber-400">[VOTRE NUMÉRO DE TÉLÉPHONE DÉDIÉ POUR LE BAL]</strong>
                </p>
                <p className="font-bold text-amber-400 mb-2">
                  IMPORTANT : Après avoir effectué votre paiement, veuillez entrer ci-dessous le numéro de transaction (ou ID de référence) fourni par Mobile Money. C'est essentiel pour confirmer votre inscription.
                </p>
                <p className="italic text-sm text-gray-400">
                  Note : Votre inscription ne sera validée qu'après vérification de votre paiement.
                </p>
              </div>

              <div className="mb-4">
                <label htmlFor="transactionId" className="block text-gray-200 font-bold mb-2">Numéro de Transaction / ID de Référence du Paiement :</label>
                <input type="text" id="transactionId" name="transactionId" value={fullFormData.transactionId} onChange={handleChangeFullForm} required
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none" />
                <small className="block mt-1 text-gray-400 text-sm">Ex: AT20250617XXXXX ou MOOV20250617XXXXX</small>
              </div>
            </fieldset>

            {/* Section Confirmation */}
            <fieldset className="border border-gray-600 rounded-lg p-6 relative">
              <legend className="text-amber-400 text-xl font-bold px-2 bg-gray-900 rounded-md absolute -top-4 left-5">Confirmation</legend>

              <div className="mb-4 flex items-start">
                <input type="checkbox" id="accord" name="accord" checked={fullFormData.accord} onChange={handleChangeFullForm} required
                  className="mr-3 mt-1 text-amber-400 bg-gray-800 border-gray-700 focus:ring-amber-500 rounded-full" />
                <label htmlFor="accord" className="text-gray-200 cursor-pointer">Je confirme avoir lu et compris les informations relatives au Bal des Bacheliers, y compris les prix et le programme. Je comprends que ma place ne sera confirmée qu'après vérification du paiement.</label>
              </div>

              <div className="mb-4">
                <label htmlFor="remarques" className="block text-gray-200 font-bold mb-2">Questions / Remarques (Optionnel) :</label>
                <textarea id="remarques" name="remarques" value={fullFormData.remarques} onChange={handleChangeFullForm} rows="4"
                  className="w-full p-3 rounded-md border border-gray-700 bg-gray-800 text-gray-100 focus:border-amber-400 focus:ring-1 focus:ring-amber-400 outline-none"></textarea>
              </div>
            </fieldset>

            <button type="submit" className="w-full py-4 bg-amber-400 text-gray-900 font-bold text-xl uppercase tracking-wider rounded-lg shadow-lg hover:bg-amber-500 transform hover:-translate-y-1 transition duration-200 ease-in-out">
              Soumettre l'Inscription
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Vue pour le Statut de Paiement
  if (currentView === 'paymentStatusView') {
    return (
      <div className="min-h-screen flex justify-center items-center py-8 bg-gray-950 text-gray-100 font-inter">
        <div className="container max-w-lg w-full p-8 rounded-xl shadow-lg bg-gray-900 text-center">
          {user && (
            <div className="text-right mb-4">
              <span className="text-gray-400 text-sm mr-2">Connecté(e) : {user.email}</span>
              <button onClick={handleLogout} className="px-4 py-2 bg-red-600 text-white font-bold rounded-md hover:bg-red-700 transition duration-200">
                Déconnexion
              </button>
            </div>
          )}
          <h2 className="text-3xl font-bold text-amber-400 mb-6">Statut de Votre Inscription</h2>

          {paymentVerificationStatus === 'pending' && (
            <div className="bg-blue-900 text-blue-200 p-4 rounded-md mb-6">
              <p className="font-bold text-xl mb-2">Vérification du paiement en cours...</p>
              <p>Votre numéro de transaction <strong className="text-blue-100">{fullFormData.transactionId}</strong> est en cours de vérification manuelle par notre équipe.</p>
              <p className="mt-2">Veuillez revenir dans environ 24 heures pour connaître le statut final de votre inscription.</p>
            </div>
          )}

          {paymentVerificationStatus === 'confirmed' && (
            <div className="bg-emerald-900 text-emerald-200 p-4 rounded-md mb-6">
              <p className="font-bold text-xl mb-2">Paiement Confirmé !</p>
              <p>Votre inscription est validée. Vous pouvez dès maintenant télécharger votre billet d'invitation.</p>
              <p className="font-bold mt-4">Nom: {userInfoFormData.nom} {userInfoFormData.prenom}</p>
              <p>Type de Billet: {fullFormData.typeBillet.split(' - ')[0]}</p>
              <a
                href={INVITATION_PDF_URL} // Utilisez l'URL définie en haut du composant
                download="Billet_Invitation_Bal_Bacheliers.pdf"
                className="mt-6 inline-block py-3 px-8 bg-amber-400 text-gray-900 font-bold text-lg rounded-lg shadow-md hover:bg-amber-500 transition duration-200"
                target="_blank"
                rel="noopener noreferrer"
              >
                Télécharger Mon Billet
              </a>
            </div>
          )}

          {paymentVerificationStatus === 'rejected' && (
            <div className="bg-red-900 text-red-200 p-4 rounded-md mb-6">
              <p className="font-bold text-xl mb-2">Paiement Rejeté 😞</p>
              <p>Nous n'avons pas pu confirmer votre paiement avec le numéro de transaction <strong className="text-red-100">{fullFormData.transactionId}</strong>.</p>
              <p className="mt-2">Veuillez vérifier les informations de paiement ou <strong className="text-red-100">nous contacter directement</strong> pour résoudre ce problème.</p>
            </div>
          )}

          {paymentVerificationStatus === 'not_submitted' && (
            <div className="bg-gray-800 text-gray-300 p-4 rounded-md mb-6">
              <p className="font-bold text-xl mb-2">Aucun paiement soumis pour le moment.</p>
              <p>Veuillez compléter le formulaire d'inscription pour commencer le processus de paiement.</p>
              <button
                onClick={() => setCurrentView('userInfoForm')}
                className="mt-6 w-full py-3 bg-gray-700 text-gray-100 font-bold text-lg rounded-lg shadow-md hover:bg-gray-600 transition duration-200"
              >
                Remplir le Formulaire
              </button>
            </div>
          )}

          {/* Boutons de simulation pour le développement/test (à retirer en production) */}
          <div className="mt-8 pt-4 border-t border-gray-700">
            <p className="text-gray-500 text-sm mb-4">Fonctionnalités de simulation (pour tests uniquement) :</p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => simulatePaymentUpdate('confirmed')}
                className="py-2 px-4 bg-lime-700 text-white rounded-md hover:bg-lime-800 transition duration-200"
              >
                Simuler Confirmé
              </button>
              <button
                onClick={() => simulatePaymentUpdate('rejected')}
                className="py-2 px-4 bg-rose-700 text-white rounded-md hover:bg-rose-800 transition duration-200"
              >
                Simuler Rejeté
              </button>
              <button
                onClick={() => simulatePaymentUpdate('pending')}
                className="py-2 px-4 bg-orange-700 text-white rounded-md hover:bg-orange-800 transition duration-200"
              >
                Simuler En Attente
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Si aucune des vues précédentes ne correspond, retourner null (ou un composant de chargement/erreur)
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950 text-gray-100">
      <p>Chargement de l'application...</p>
    </div>
  );
}

export default App;
