import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Navron Labs Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyCNNYW2yFiRYNJy_0JWCtg8maP3emmNaxg",
    authDomain: "navron-labs.firebaseapp.com",
    projectId: "navron-labs",
    storageBucket: "navron-labs.firebasestorage.app",
    messagingSenderId: "254518260723",
    appId: "1:254518260723:web:e9e770051c8387344f1886"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
