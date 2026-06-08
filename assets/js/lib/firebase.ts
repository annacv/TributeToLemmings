import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  addDoc,
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

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

const db = getFirestore(app);
const scoresCol = collection(db, 'scores');

export async function submitScore(name: string, score: number): Promise<void> {
  await addDoc(scoresCol, { name, score, createdAt: serverTimestamp() });
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
