import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  orderBy,
  limit,
  where,
  getDocs,
  getCountFromServer,
  serverTimestamp,
  type Timestamp,
} from 'firebase/firestore';

export type ScoreRecord = {
  id: string;
  name: string;
  score: number;
  createdAt: Timestamp;
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const scoresCol = collection(db, 'scores');

export async function submitScore(
  name: string,
  score: number,
): Promise<{ docId: string; bestScore: number }> {
  const existing = await getDocs(query(scoresCol, where('name', '==', name), limit(1)));

  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const storedBest = (existingDoc.data() as ScoreRecord).score;
    if (score > storedBest) {
      await updateDoc(existingDoc.ref, { score, createdAt: serverTimestamp() });
    }
    return { docId: existingDoc.id, bestScore: Math.max(score, storedBest) };
  }

  const docRef = doc(scoresCol);
  await setDoc(docRef, { id: docRef.id, name, score, createdAt: serverTimestamp() });
  return { docId: docRef.id, bestScore: score };
}

export async function fetchTopScores(n: number): Promise<ScoreRecord[]> {
  const q = query(scoresCol, orderBy('score', 'desc'), limit(n));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as Omit<ScoreRecord, 'id'>),
  }));
}

export async function getPlayerRank(score: number): Promise<number> {
  const q = query(scoresCol, where('score', '>', score));
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count + 1;
}
