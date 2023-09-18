// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
const { getFirestore } = require("firebase-admin/firestore");
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
	apiKey: "AIzaSyCYkoSDh543spedFITfMSNf2z2xfunMEt0",
	authDomain: "sensebuy-e8add.firebaseapp.com",
	projectId: "sensebuy-e8add",
	storageBucket: "sensebuy-e8add.appspot.com",
	messagingSenderId: "924824526379",
	appId: "1:924824526379:web:863df814c044b86aa1546e",
	measurementId: "G-HXFZGJF236"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore()

module.exports = { 
	admin, 
	db, 
	// realDB, 
	analytics 
}; 