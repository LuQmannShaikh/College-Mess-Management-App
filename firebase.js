/* =========================================================
   Firebase Configuration & Initialisation - Royal Mess
   ========================================================= */

// 1. Firebase Console (https://console.firebase.google.com) se mili Web App Config Keys
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// 2. Prevent Duplicate App Initializations
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // Existing instance use karein
}

// 3. Global Firestore Instance
const db = firebase.firestore();

// 4. Enable Offline Persistence
// Isse network slow ya disconnect hone par bhi scanner aur student pass ka local cache chalta rahega
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Offline persistence: Ek se zyada tabs khule hain.");
    } else if (err.code === 'unimplemented') {
      console.warn("Offline persistence: Browser support nahi karta.");
    }
  });
