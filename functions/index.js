// functions/index.js

// Importe les modules nécessaires de Firebase Functions et Admin SDK
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp(); // Initialise l'admin SDK avec la configuration par défaut du projet

// Obtient une référence à la base de données Firestore
const db = admin.firestore();

// Pour faire des requêtes HTTP sortantes (vers la passerelle de paiement)
// Assurez-vous d'avoir 'node-fetch@2' installé : npm install node-fetch@2
const fetch = require('node-fetch');

// Importe Nodemailer pour l'envoi d'e-mails
// Vous devrez installer ce package : npm install nodemailer
const nodemailer = require('nodemailer');

// --- Configuration du transporteur Nodemailer ---
// Les informations d'identification pour l'envoi d'e-mails doivent être stockées
// en toute sécurité dans les variables d'environnement de Firebase Functions.
// Exécutez dans votre terminal Firebase CLI :
// firebase functions:config:set email.user="VOTRE_EMAIL@gmail.com" email.pass="VOTRE_MOT_DE_PASSE_APPLI_GMAIL_OU_PASS_SMTP" email.host="smtp.gmail.com" email.port="465" email.secure="true"
// (Adaptez pour d'autres services comme SendGrid, Sendinblue, etc. et le port/secure correspondant)
const transporter = nodemailer.createTransport({
    host: functions.config().email.host,
    port: parseInt(functions.config().email.port), // Convertir le port en entier
    secure: functions.config().email.secure === 'true', // true pour 465, false pour les autres ports
    auth: {
        user: functions.config().email.user,
        pass: functions.config().email.pass,
    },
});

// Fonction utilitaire pour envoyer un e-mail
async function sendEmail(to, subject, htmlContent) {
    const mailOptions = {
        from: `Bal des Bacheliers <${functions.config().email.user}>`, // Expéditeur visible
        to: to,
        subject: subject,
        html: htmlContent,
    };

    try {
        await transporter.sendMail(mailOptions);
        functions.logger.log(`E-mail envoyé avec succès à ${to} pour le sujet: ${subject}`);
        return { success: true };
    } catch (error) {
        functions.logger.error(`Erreur lors de l'envoi de l'e-mail à ${to}:`, error);
        return { success: false, error: error.message };
    }
}

// --- Nouvelle Fonction HTTP pour la confirmation d'enregistrement initial ---
// Cette fonction est appelée après la soumission de la première partie du formulaire (informations personnelles)
exports.sendRegistrationConfirmationEmail = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*'); // À restreindre en production
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { email, nom, prenom } = req.body;

    if (!email || !nom || !prenom) {
        return res.status(400).json({ message: 'Missing required fields (email, nom, prenom).' });
    }

    const subject = "Votre inscription préliminaire au Bal des Bacheliers 2K25 est enregistrée !";
    const html = `
        <p>Bonjour ${prenom},</p>
        <p>Nous vous confirmons que vos informations ont bien été enregistrées pour le Bal des Bacheliers 2K25.</p>
        <p>Il ne vous reste plus qu'à finaliser votre inscription en complétant les détails du billet et du paiement.</p>
        <p>Connectez-vous à nouveau à l'application pour accéder à la suite du formulaire et finaliser votre place.</p>
        <p>Merci et à très bientôt !</p>
        <p>L'équipe du Bal des Bacheliers</p>
    `;

    const emailResult = await sendEmail(email, subject, html);

    if (emailResult.success) {
        return res.status(200).json({ message: 'Confirmation email sent successfully.' });
    } else {
        return res.status(500).json({ message: 'Failed to send confirmation email.', error: emailResult.error });
    }
});


// --- Fonction HTTP pour initier le paiement depuis le formulaire React (EXISTANTE, PAS DE CHANGEMENT MAJEUR) ---
exports.processPayment = functions.https.onRequest(async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*'); // ATTENTION: À restreindre en production
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        res.set('Access-Control-Max-Age', '3600');
        return res.status(204).send('');
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const { nom, prenom, telephone, email, montant, statut, classe, inviteExterne, typeBillet, transactionId, userId } = req.body;

    // Pour cette fonction, transactionId est l'ID Firestore du document d'inscription
    if (!userId || !nom || !prenom || !telephone || !email || !montant || !statut || !transactionId) {
        return res.status(400).json({ message: 'Missing required fields for payment processing.' });
    }
    if (!/^\d{7,9}$/.test(telephone.trim())) {
        return res.status(400).json({ message: 'Invalid phone number format. Expected 7-9 digits.' });
    }
    if (isNaN(montant) || montant <= 0) {
        return res.status(400).json({ message: 'Invalid amount. Amount must be a positive number.' });
    }

    const userDocRef = db.collection('inscriptions').doc(userId); // Utilise userId comme ID du document

    try {
        // Mise à jour du document Firestore existant avec les détails du paiement
        await userDocRef.update({
            statutEleve: statut,
            inviteExterne: statut === 'Externe' ? inviteExterne : null,
            typeBillet: typeBillet,
            montantPaye: Number(montant),
            transactionId: transactionId, // ID de transaction Mobile Money fourni par l'utilisateur
            status: 'completed_registration', // Marque l'inscription comme complète côté Firestore
            paymentStatus: 'pending', // Définit le statut de paiement sur 'pending'
            lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.log(`Inscription mise à jour dans Firestore pour le paiement : ${userId}`);

        // --- Étape 2: Appeler l'API de la Passerelle de Paiement (à adapter) ---
        // Le code ci-dessous est un exemple conceptuel. Vous DEVEZ l'adapter
        // avec les détails exacts de votre passerelle de paiement (CinetPay, Flutterwave, etc.)
        const paymentGatewayApiUrl = functions.config().payment_gateway.api_url;
        const paymentGatewayApiKey = functions.config().payment_gateway.api_key;
        // const paymentGatewaySecretKey = functions.config().payment_gateway.secret_key; // Si nécessaire

        const paymentPayload = {
            apikey: paymentGatewayApiKey,
            site_id: paymentGatewayApiKey, // Certaines passerelles utilisent api_key comme site_id
            transaction_id: transactionId, // Utilise l'ID de transaction fourni par l'utilisateur
            currency: 'XAF',
            amount: montant,
            description: `Billet Bal des Bacheliers pour ${nom} ${prenom} (Référence: ${transactionId})`,
            customer_phone_number: telephone,
            // L'URL de votre webhook où la passerelle enverra le statut final du paiement
            notify_url: `https://${process.env.GCLOUD_PROJECT}.cloudfunctions.net/paymentWebhook`,
            // L'URL de retour pour l'utilisateur après le processus de paiement sur la page de la passerelle
            return_url: `https://votre-domaine-frontend.com/payment-status?status={STATUS}&id=${userId}`, // Adaptez à votre domaine frontend
        };

        const paymentGatewayResponse = await fetch(paymentGatewayApiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Ajoutez ici les en-têtes d'authentification requis par votre passerelle
            },
            body: JSON.stringify(paymentPayload),
        });

        const paymentResult = await paymentGatewayResponse.json();
        functions.logger.log('Réponse de la passerelle de paiement:', paymentResult);

        if (paymentGatewayResponse.ok && paymentResult.code === '201') { // Code de succès exemple (CinetPay)
            // La passerelle de paiement a bien reçu la demande.
            // Maintenant, l'utilisateur doit confirmer sur son téléphone.
            return res.status(200).json({
                success: true,
                message: 'Demande de paiement soumise. Veuillez confirmer la transaction sur votre téléphone Mobile Money.',
                redirectUrl: paymentResult.data && paymentResult.data.payment_url ? paymentResult.data.payment_url : null,
                paymentStatus: 'pending', // Confirme le statut 'pending' au frontend
            });
        } else {
            // Si la passerelle refuse l'initialisation du paiement
            await userDocRef.update({ paymentStatus: 'failed_initiation', lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
            // Pas d'email ici car le webhook s'en chargera en cas d'échec de la transaction réelle,
            // ou l'utilisateur sera informé via le frontend.
            return res.status(200).json({ // Retourne 200 avec message d'échec pour gérer côté client
                success: false,
                message: `Échec d'initialisation du paiement: ${paymentResult.message || 'Erreur inconnue de la passerelle.'}`,
                paymentStatus: 'rejected', // Statut rejeté côté frontend
                details: paymentResult
            });
        }

    } catch (error) {
        functions.logger.error('Erreur inattendue lors du processus de paiement:', error);
        // Si une erreur survient, marquez l'inscription comme ayant échoué
        if (userDocRef) {
             await userDocRef.update({ paymentStatus: 'failed_internal_error', lastUpdated: admin.firestore.FieldValue.serverTimestamp() });
        }
        return res.status(500).json({
            success: false,
            message: 'Erreur interne du serveur lors du traitement du paiement. Veuillez réessayer.',
            paymentStatus: 'rejected'
        });
    }
});


// --- Fonction HTTP pour gérer les Webhooks de la Passerelle de Paiement (EXISTANTE, PAS DE CHANGEMENT MAJEUR) ---
// Cette fonction sera appelée automatiquement par la passerelle de paiement
// quand une transaction est finalisée (réussie ou échouée).
exports.paymentWebhook = functions.https.onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // IMPORTANT: Validez la signature du webhook si votre passerelle en fournit une !
    // C'est crucial pour la sécurité afin de s'assurer que la notification vient bien
    // de votre passerelle de paiement et n'a pas été falsifiée.
    const paymentNotification = req.body;
    functions.logger.log('Webhook reçu:', paymentNotification);

    // Ces noms de champs (cpm_trans_id, cpm_result, etc.) DOIVENT correspondre à la structure
    // des données envoyées par le webhook de votre passerelle de paiement.
    const transactionIdFromGateway = paymentNotification.cpm_trans_id || paymentNotification.transaction_id || paymentNotification.order_id;
    const paymentStatusFromGateway = paymentNotification.cpm_result || paymentNotification.status || paymentNotification.payment_status;
    // Récupérer l'ID utilisateur que nous avons pu envoyer à la passerelle, par exemple via un champ 'custom' ou 'metadata'
    // C'est crucial pour lier le webhook à notre utilisateur dans Firestore.
    // Pour cet exemple, nous allons supposer que l'ID Firestore (`userId`) est dans `transactionIdFromGateway` pour simplifier.
    // En réalité, vous devriez passer le `userId` comme un paramètre `custom` ou `metadata` à la passerelle.
    const userIdAssociated = transactionIdFromGateway; // À adapter si votre passerelle utilise un autre champ pour l'ID de retour

    if (!transactionIdFromGateway || !paymentStatusFromGateway || !userIdAssociated) {
        functions.logger.error('Webhook invalide: Données essentielles manquantes', paymentNotification);
        return res.status(400).send('Invalid webhook data');
    }

    try {
        // Trouver le document d'inscription correspondant dans Firestore via le userId
        const inscriptionRef = db.collection('inscriptions').doc(userIdAssociated);
        const inscriptionDoc = await inscriptionRef.get();

        if (!inscriptionDoc.exists) {
            functions.logger.error('Inscription non trouvée pour l\'ID utilisateur du webhook:', userIdAssociated);
            return res.status(404).send('Inscription not found for this user ID');
        }

        const currentData = inscriptionDoc.data();
        const userEmail = currentData.email;
        const userPrenom = currentData.prenom || 'Cher participant';
        const userNom = currentData.nom || '';

        let newPaymentStatus;
        let emailSubject;
        let emailHtml;
        let confettiTrigger = false; // Indicateur pour le frontend

        // Adaptez ces conditions aux statuts exacts envoyés par votre passerelle
        if (paymentStatusFromGateway === '00' || paymentStatusFromGateway === 'SUCCESS' || paymentStatusFromGateway === 'COMPLETED' || paymentStatusFromGateway === 'paid') {
            newPaymentStatus = 'confirmed';
            emailSubject = "Votre paiement pour le Bal des Bacheliers 2K25 est CONFIRMÉ ! 🎉";
            emailHtml = `
                <p>Bonjour ${userPrenom},</p>
                <p>Excellente nouvelle ! Votre paiement pour le Bal des Bacheliers 2K25 a été confirmé avec succès.</p>
                <p>Votre inscription est maintenant validée et votre place est sécurisée !</p>
                <p>Vous pouvez télécharger votre billet d'invitation <a href="https://drive.google.com/file/d/1ulbXhIuLIOqfHHLNRnBVPTN6XKwpxBFt/view?usp=drive_link">ici</a>.</p>
                <p>Nous avons hâte de vous voir !</p>
                <p>L'équipe du Bal des Bacheliers</p>
            `;
            confettiTrigger = true; // Activer les confettis
        } else { // Traiter tous les autres statuts comme un échec pour cet exemple
            newPaymentStatus = 'rejected';
            emailSubject = "Problème avec votre paiement pour le Bal des Bacheliers 2K25 😞";
            emailHtml = `
                <p>Bonjour ${userPrenom},</p>
                <p>Malheureusement, nous n'avons pas pu confirmer votre paiement pour le Bal des Bacheliers 2K25.</p>
                <p>Le statut de votre transaction est : <strong>${paymentStatusFromGateway}</strong></p>
                <p>Veuillez vérifier les détails de votre paiement ou réessayer. Si le problème persiste, veuillez nous contacter.</p>
                <p>Votre numéro de référence d'inscription est : <strong>${transactionIdFromGateway}</strong></p>
                <p>L'équipe du Bal des Bacheliers</p>
            `;
        }

        // Mettre à jour le statut du paiement dans Firestore
        await inscriptionRef.update({
            paymentStatus: newPaymentStatus,
            transactionIdGateway: transactionIdFromGateway, // Enregistrer l'ID de la passerelle si différent
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        functions.logger.log(`Statut de paiement mis à jour pour l'inscription ${userIdAssociated}: ${newPaymentStatus}`);

        // --- ENVOI DE L'EMAIL DE STATUT DE PAIEMENT ---
        if (userEmail) {
            await sendEmail(userEmail, emailSubject, emailHtml);
        }

        // Toujours répondre avec un statut 200 OK pour indiquer à la passerelle que le webhook a été reçu.
        return res.status(200).send('Webhook processed successfully');

    } catch (error) {
        functions.logger.error('Erreur lors du traitement du webhook:', error);
        return res.status(500).send('Internal Server Error during webhook processing');
    }
});
