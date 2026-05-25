import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Твой конфиг из скриншота настроек проекта
const firebaseConfig = {
  apiKey: "AIzaSyCtU7kChq_8VuzcFTKGzj5lxFFeFiFESdw",
  authDomain: "teamplay-ce222.firebaseapp.com",
  projectId: "teamplay-ce222",
  storageBucket: "teamplay-ce222.appspot.com",
  messagingSenderId: "808276396820",
  appId: "1:808276396820:web:df6d902e489bc9c8cb9001"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

export { db, storage };
