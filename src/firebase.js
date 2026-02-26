// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc, setDoc, getDocs, getDoc, doc, serverTimestamp } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBPT7Bnp4o_ejRwaLaARQEV4r0bEB9ZevM",
  authDomain: "territorymanager2-bd211.firebaseapp.com",
  projectId: "territorymanager2-bd211",
  storageBucket: "territorymanager2-bd211.firebasestorage.app",
  messagingSenderId: "392385378009",
  appId: "1:392385378009:web:f4387334633936ef2930c8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);