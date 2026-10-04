/* =========================================================
   Firebase Configuration & Initialisation - Royal Mess
   ========================================================= */

// Firebase Console se mili aapki Web App Config Keys
const firebaseConfig = {
  apiKey: "AIzaSyDBn5d__u-AZwsoXogynKk", 
  authDomain: "college-mess-management.firebaseapp.com",
  projectId: "college-mess-management",
  storageBucket: "college-mess-management.appspot.com",
  messagingSenderId: "995090725312",
  appId: "1:995090725312:web:e67fd4b71", 
  measurementId: "G-2H9M3LW54C"
};

// Prevent Duplicate App Initializations
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
} else {
  firebase.app(); // Existing instance use karein
}

// Global Firestore Instance
const db = firebase.firestore();

// Enable Offline Persistence
// Isse network slow ya disconnect hone par bhi scanner aur student pass ka local cache chalta rahega
db.enablePersistence({ synchronizeTabs: true })
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      console.warn("Offline persistence: Ek se zyada tabs khule hain.");
    } else if (err.code === 'unimplemented') {
      console.warn("Offline persistence: Browser support nahi karta.");
    }
  });
