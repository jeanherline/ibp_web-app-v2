import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  startAfter, 
  orderBy, 
  updateDoc,
  getDoc,
  setDoc,
  addDoc,
  serverTimestamp,
  deleteDoc
} from 'firebase/firestore';
import { getAuth, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCKu6xS_8cIlMD4x4srwGLOiB_bfBEpdiM",
  authDomain: "lawyer-app-ed056.firebaseapp.com",
  projectId: "lawyer-app-ed056",
  storageBucket: "lawyer-app-ed056.appspot.com",
  messagingSenderId: "610288789461",
  appId: "1:610288789461:web:463aa4a5c90ad51dacbf5c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const fs = getFirestore(app);
const storage = getStorage(app);

export { 
  app, auth, fs, storage, 
  doc, deleteDoc, collection, query, where, getDocs, addDoc,
  limit, startAfter, orderBy, updateDoc, getDoc, setDoc, serverTimestamp,
  signOut, createUserWithEmailAndPassword, ref, uploadBytes, getDownloadURL 
};
