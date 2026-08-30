import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// NOTE: Firebase の Web 設定は秘匿情報ではなく、実質的な防御は firestore.rules 側で行う。
// （他のミニアプリと同様に、この値はコミットして良い）
const firebaseConfig = {
  apiKey: 'AIzaSyB9Ka0IXhQYuVyI_2n2As3c-GY1lVqZWQQ',
  authDomain: 'leverage-tenken.firebaseapp.com',
  projectId: 'leverage-tenken',
  storageBucket: 'leverage-tenken.firebasestorage.app',
  messagingSenderId: '781154638196',
  appId: '1:781154638196:web:85eac04912797e6b2ff421',
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
