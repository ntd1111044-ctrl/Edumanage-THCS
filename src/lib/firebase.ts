/**
 * Firebase Realtime Database - Đồng bộ dữ liệu thời gian thực GV ↔ HS
 * 
 * HƯỚNG DẪN: Thay thế firebaseConfig bên dưới bằng config từ Firebase Console của bạn.
 * Xem: https://console.firebase.google.com/ → Project Settings → General → Your apps → Web
 */

import { initializeApp, getApp } from 'firebase/app';
import {
  getDatabase,
  ref,
  set,
  get,
  onValue,
  off,
  onDisconnect,
  serverTimestamp,
  DatabaseReference,
  DataSnapshot
} from 'firebase/database';

// ⚠️ THAY THẾ CÁC GIÁ TRỊ NÀY BẰNG CONFIG TỪ FIREBASE CONSOLE CỦA BẠN
const firebaseConfig = {
  apiKey: "AIzaSyCrBN3lgUQy2hqeXLN1uklJ0XKqMEV1hD4",
  authDomain: "edumanage-thcs.firebaseapp.com",
  databaseURL: "https://edumanage-thcs-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "edumanage-thcs",
  storageBucket: "edumanage-thcs.firebasestorage.app",
  messagingSenderId: "611119290594",
  appId: "1:611119290594:web:156e03e382ea54692426bb"
};

// Kiểm tra xem đã config chưa
export function isFirebaseConfigured(): boolean {
  return !firebaseConfig.apiKey.startsWith('YOUR_');
}

// Khởi tạo Firebase
let app: ReturnType<typeof initializeApp> | null = null;
let database: ReturnType<typeof getDatabase> | null = null;

function getFirebaseDB() {
  if (!database) {
    if (!isFirebaseConfigured()) {
      throw new Error('Firebase chưa được cấu hình.');
    }
    try {
      app = initializeApp(firebaseConfig);
    } catch (e: any) {
      // Nếu app đã được khởi tạo rồi (duplicate), lấy app hiện có
      if (e.code === 'app/duplicate-app') {
        app = getApp();
      } else {
        throw e;
      }
    }
    database = getDatabase(app!);
  }
  return database;
}

/**
 * Firebase tự động xoá mảng rỗng ([] → undefined)
 * Hàm này đảm bảo tất cả arrays luôn tồn tại
 */
export function normalizeAppData(data: any): any {
  if (!data) return data;
  return {
    ...data,
    students: Array.isArray(data.students) ? data.students : [],
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    grades: Array.isArray(data.grades) ? data.grades : [],
    behaviors: Array.isArray(data.behaviors) ? data.behaviors : [],
    funds: Array.isArray(data.funds) ? data.funds : [],
    attendance: Array.isArray(data.attendance) ? data.attendance : [],
    tasks: Array.isArray(data.tasks) ? data.tasks : [],
    submissions: Array.isArray(data.submissions) ? data.submissions : [],
    admissionScores2025: Array.isArray(data.admissionScores2025) ? data.admissionScores2025 : [],
    awards: Array.isArray(data.awards) ? data.awards : [],
    settings: data.settings || { theme: 'light', apiKey: '', selectedModel: 'gemini-3-flash-preview', teacherPassword: '1234' }
  };
}

/**
 * Tạo mã phòng 6 ký tự (chữ + số)
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Bỏ 0,O,1,I để tránh nhầm
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * GV tạo phòng mới trên Firebase
 */
export async function createRoom(teacherPassword: string, initialData: any): Promise<string> {
  const db = getFirebaseDB();
  let roomCode = generateRoomCode();
  
  // Đảm bảo mã phòng chưa tồn tại
  let attempts = 0;
  while (attempts < 10) {
    const snapshot = await get(ref(db, `rooms/${roomCode}`));
    if (!snapshot.exists()) break;
    roomCode = generateRoomCode();
    attempts++;
  }
  
  // Tách apiKey ra khỏi data trước khi lưu lên cloud
  const { apiKey, ...settingsWithoutKey } = initialData.settings || {};
  const cloudData = {
    ...initialData,
    settings: settingsWithoutKey
  };
  
  await set(ref(db, `rooms/${roomCode}`), {
    createdAt: new Date().toISOString(),
    teacherPassword: teacherPassword,
    data: cloudData
  });
  
  return roomCode;
}

/**
 * Kiểm tra phòng có tồn tại không
 */
export async function checkRoomExists(roomCode: string): Promise<boolean> {
  const db = getFirebaseDB();
  const snapshot = await get(ref(db, `rooms/${roomCode}`));
  return snapshot.exists();
}

/**
 * Xác thực GV vào phòng cũ
 */
export async function verifyTeacherPassword(roomCode: string, password: string): Promise<boolean> {
  const db = getFirebaseDB();
  const snapshot = await get(ref(db, `rooms/${roomCode}/teacherPassword`));
  if (!snapshot.exists()) return false;
  return snapshot.val() === password;
}

/**
 * GV ghi dữ liệu lên Firebase (debounced trong hook)
 */
export async function syncDataToFirebase(roomCode: string, data: any): Promise<void> {
  const db = getFirebaseDB();
  
  // Tách apiKey ra khỏi settings trước khi sync
  const { apiKey, ...settingsWithoutKey } = data.settings || {};
  const cloudData = {
    ...data,
    settings: settingsWithoutKey
  };
  
  await set(ref(db, `rooms/${roomCode}/data`), cloudData);
}

/**
 * Lắng nghe thay đổi dữ liệu real-time
 */
export function listenToRoomData(
  roomCode: string,
  callback: (data: any) => void
): () => void {
  const db = getFirebaseDB();
  const dataRef = ref(db, `rooms/${roomCode}/data`);
  
  const unsubscribe = onValue(dataRef, (snapshot: DataSnapshot) => {
    if (snapshot.exists()) {
      callback(normalizeAppData(snapshot.val()));
    }
  });
  
  // Trả về hàm cleanup
  return () => off(dataRef);
}

/**
 * Lắng nghe trạng thái kết nối Firebase
 */
export function listenToConnectionStatus(
  callback: (connected: boolean) => void
): () => void {
  const db = getFirebaseDB();
  const connectedRef = ref(db, '.info/connected');
  
  const unsubscribe = onValue(connectedRef, (snapshot: DataSnapshot) => {
    callback(snapshot.val() === true);
  });
  
  return () => off(connectedRef);
}

/**
 * Lấy dữ liệu phòng 1 lần (không real-time)
 */
export async function getRoomData(roomCode: string): Promise<any | null> {
  const db = getFirebaseDB();
  const snapshot = await get(ref(db, `rooms/${roomCode}/data`));
  if (snapshot.exists()) {
    return normalizeAppData(snapshot.val());
  }
  return null;
}
