import { initializeApp } 
    from "https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js";

import {
    getAuth,
    GoogleAuthProvider,
    signInWithPopup
} 
    from "https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js";


// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA2FZ0LQNthxkVrpI1CCM47KB44yHKhUSw",
  authDomain: "fir-project-69ca4.firebaseapp.com",
  projectId: "fir-project-69ca4",
  storageBucket: "fir-project-69ca4.firebasestorage.app",
  messagingSenderId: "383092787994",
  appId: "1:383092787994:web:923f1f0b604248752e7aa3",
  measurementId: "G-3M87BJBP05"
};


const app = initializeApp(firebaseConfig);

const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();


export {
    auth,
    googleProvider,
    signInWithPopup
};