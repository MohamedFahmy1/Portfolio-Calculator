import { initializeApp } from "firebase/app";
import { doc, getFirestore, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

const portfolioSnapshot = {
  values: {
    usdAmount: "38773",
    usdRate: "53.4",
    goldGrams: "20",
    goldPricePerGram: "8200",
    stocksValue: "36000",
    cashEntries: [
      {
        id: "6b254840-9b69-46f9-835e-035ec9d40871",
        note: "NBE",
        amount: "1631207",
      },
      {
        id: "4f2634f1-3c25-4560-905e-557b740ab1a8",
        note: "Bank Masr",
        amount: "144800",
      },
      {
        id: "f65634a7-7727-485f-af33-a14e24724df5",
        note: "CIB",
        amount: "129000",
      },
      {
        id: "083f0cbd-dc2e-43df-815a-72789bc9f22b",
        note: "Mom",
        amount: "105150",
      },
      {
        id: "b8808340-b8d9-484a-979a-0210eac638a4",
        note: "5alto",
        amount: "100000",
      },
    ],
    bankCertificates: "120000",
  },
  updatedAt: "2026-04-13T21:52:54.781Z",
};

const app = initializeApp(firebaseConfig);
const firestore = getFirestore(app);

await setDoc(doc(firestore, "portfolios", "default"), portfolioSnapshot);

console.log("Seeded Firestore document portfolios/default");
