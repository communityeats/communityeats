// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC_npnAoshhmHzqvgHt79jENqLZ_5RchDQ",
  authDomain: "communityeats-4efe7.firebaseapp.com",
  projectId: "communityeats-4efe7",
  storageBucket: "communityeats-4efe7.firebasestorage.app",
  messagingSenderId: "517277045770",
  appId: "1:517277045770:web:011bcae7702be19b25bbf3",
  measurementId: "G-NLLPKLW6VV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);