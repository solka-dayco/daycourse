import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBTV-fFMF3lOH5QM23Hkf0g-gjyjEB3YPo",
  authDomain: "daycourse-98426.firebaseapp.com",
  projectId: "daycourse-98426",
  storageBucket: "daycourse-98426.firebasestorage.app",
  messagingSenderId: "779557871636",
  appId: "1:779557871636:web:ad870f83c8a185780ac701"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
