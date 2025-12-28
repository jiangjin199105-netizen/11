
const firebase = (window as any).firebase;

const firebaseConfig = {
  apiKey: "AIzaSyBGOe3ENc7XuEbEpNRkB1-14myE2kWzXvs",
  authDomain: "neonbazaar.firebaseapp.com",
  projectId: "neonbazaar",
  storageBucket: "neonbazaar.firebasestorage.app",
  messagingSenderId: "337732412220",
  appId: "1:337732412220:web:7e2d9680a9ba25be09b439",
  measurementId: "G-1D8PRGXJHJ"
};

let db: any = null;
let auth: any = null;
let isFirebaseConfigured = false;

if (typeof firebase !== 'undefined') {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        
        db = firebase.firestore();
        auth = firebase.auth();
        
        // 尝试启用离线持久化
        db.enablePersistence({ synchronizeTabs: true }).catch((err: any) => {
            console.warn("Firebase Persistence Error:", err.code);
        });

        isFirebaseConfigured = true;
    } catch (e) {
        console.warn("Firebase Init Exception:", e);
    }
} else {
    console.warn("Firebase SDK is not loaded from CDN.");
}

export { db, auth, isFirebaseConfigured, firebase };
