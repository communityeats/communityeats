// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAJR_5HMT8_qYT08MMdsfr0rAHvSfWAC14",
  authDomain: "communtiy-eats-test.firebaseapp.com",
  projectId: "communtiy-eats-test",
  storageBucket: "communtiy-eats-test.firebasestorage.app",
  messagingSenderId: "156791783572",
  appId: "1:156791783572:web:326b9acf833ba204f43481",
  measurementId: "G-PDG3N8MQE4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);