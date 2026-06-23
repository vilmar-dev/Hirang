// =====================================================
// FIREBASE CONFIGURATION
// =====================================================
// Replace the values below with your own Firebase project's
// config object. Find this in:
// Firebase Console → Project Settings → General → Your apps → SDK setup and config
//
// IMPORTANT: This project uses FIRESTORE (not Realtime Database).
// Make sure "Firestore Database" is enabled in your Firebase
// Console (Build → Firestore Database → Create Database).
// Also enable Authentication → Sign-in method → Email/Password
// for teacher logins.
// =====================================================
const firebaseConfig = {
  apiKey: "AIzaSyD8VLfnSHuZzGRPNIJiMEV9vGdg6DMxu3c",
  authDomain: "hirang-706f8.firebaseapp.com",
  projectId: "hirang-706f8",
  storageBucket: "hirang-706f8.firebasestorage.app",
  messagingSenderId: "740302752785",
  appId: "1:740302752785:web:50203e63047f5c102635b0"
};

// Initialize Firebase (compat SDK, loaded via <script> tags in HTML)
firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

// Enable Firestore's built-in offline persistence.
// This caches reads locally and queues writes while offline,
// then syncs automatically once the connection returns.
db.enablePersistence({ synchronizeTabs: true }).catch((err) => {
  if (err.code === "failed-precondition") {
    // Multiple tabs open without synchronizeTabs support — persistence
    // can only run in one tab at a time in older browsers.
    console.warn("Offline persistence only available in one tab at a time.");
  } else if (err.code === "unimplemented") {
    console.warn("This browser does not support offline persistence.");
  }
});