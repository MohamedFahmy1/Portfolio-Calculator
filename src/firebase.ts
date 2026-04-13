import { initializeApp } from "firebase/app";
import { doc, getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgw1OEhDfw7WJvtnirGuUUmuRQ_q3vFNg",
  authDomain: "portfolio-calculator-e5525.firebaseapp.com",
  projectId: "portfolio-calculator-e5525",
  storageBucket: "portfolio-calculator-e5525.firebasestorage.app",
  messagingSenderId: "137176232706",
  appId: "1:137176232706:web:40afd549ab35918bd4081b",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firestore = getFirestore(firebaseApp);
export const portfolioDocRef = doc(firestore, "portfolios", "default");
