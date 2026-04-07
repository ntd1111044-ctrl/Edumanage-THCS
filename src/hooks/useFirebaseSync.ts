/**
 * useFirebaseSync - Custom hook quản lý đồng bộ dữ liệu Firebase
 * 
 * GV mode: setData() → debounce 500ms → push lên Firebase + lưu localStorage
 * HS mode: lắng nghe Firebase → tự động cập nhật state
 */

import React, { useState, useEffect, useRef } from 'react';
import type { AppData } from '../types';

// Dynamic imports to prevent crash on load
let firebaseModule: typeof import('../lib/firebase') | null = null;

async function getFirebaseModule() {
  if (!firebaseModule) {
    try {
      firebaseModule = await import('../lib/firebase');
    } catch (e) {
      console.error('Failed to load Firebase module:', e);
      return null;
    }
  }
  return firebaseModule;
}

interface UseFirebaseSyncOptions {
  roomCode: string | null;
  userRole: 'teacher' | 'student' | null;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
}

interface UseFirebaseSyncReturn {
  isConnected: boolean;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
}

export function useFirebaseSync({
  roomCode,
  userRole,
  data,
  setData
}: UseFirebaseSyncOptions): UseFirebaseSyncReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFirstLoadRef = useRef(true);
  const lastDataJsonRef = useRef<string>('');
  const isReceivingRef = useRef(false);

  // --- Lắng nghe trạng thái kết nối ---
  useEffect(() => {
    if (!roomCode || !userRole) return;

    let cleanup: (() => void) | undefined;
    
    (async () => {
      try {
        const fb = await getFirebaseModule();
        if (!fb || !fb.isFirebaseConfigured()) return;

        cleanup = fb.listenToConnectionStatus((connected) => {
          setIsConnected(connected);
          if (connected) setSyncError(null);
        });
      } catch (e) {
        console.error('Connection listener error:', e);
      }
    })();

    return () => { if (cleanup) cleanup(); };
  }, [roomCode, userRole]);

  // --- HS: Lắng nghe dữ liệu real-time từ Firebase ---
  useEffect(() => {
    if (!roomCode || userRole !== 'student') return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const fb = await getFirebaseModule();
        if (!fb || !fb.isFirebaseConfigured()) return;

        cleanup = fb.listenToRoomData(roomCode, (firebaseData) => {
          if (firebaseData) {
            isReceivingRef.current = true;
            
            // Khôi phục apiKey từ localStorage
            const localApiKey = (() => {
              try {
                const saved = localStorage.getItem('edumanage_data');
                if (saved) return JSON.parse(saved).settings?.apiKey || '';
              } catch { /* ignore */ }
              return '';
            })();

            const mergedData: AppData = {
              ...firebaseData,
              settings: {
                ...firebaseData.settings,
                apiKey: localApiKey
              }
            };

            setData(mergedData);
            setLastSyncTime(new Date());
            
            setTimeout(() => {
              isReceivingRef.current = false;
            }, 100);
          }
        });
      } catch (e) {
        console.error('Student listener error:', e);
      }
    })();

    return () => { if (cleanup) cleanup(); };
  }, [roomCode, userRole, setData]);

  // --- GV: Push dữ liệu lên Firebase khi thay đổi (debounced) ---
  useEffect(() => {
    if (!roomCode || userRole !== 'teacher') return;
    
    // Skip nếu đang nhận data từ Firebase (tránh loop)
    if (isReceivingRef.current) return;

    // Skip lần đầu load
    if (isFirstLoadRef.current) {
      isFirstLoadRef.current = false;
      lastDataJsonRef.current = JSON.stringify(data);
      return;
    }

    // So sánh để tránh sync không cần thiết
    const currentJson = JSON.stringify(data);
    if (currentJson === lastDataJsonRef.current) return;
    lastDataJsonRef.current = currentJson;

    // Debounce 500ms
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const fb = await getFirebaseModule();
        if (!fb || !fb.isFirebaseConfigured()) return;

        setIsSyncing(true);
        await fb.syncDataToFirebase(roomCode, data);
        setLastSyncTime(new Date());
        setSyncError(null);
      } catch (error: any) {
        console.error('Firebase sync error:', error);
        setSyncError(error.message || 'Lỗi đồng bộ dữ liệu');
      } finally {
        setIsSyncing(false);
      }
    }, 500);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [roomCode, userRole, data]);

  // --- GV: Lắng nghe Firebase để đồng bộ từ bên ngoài ---
  useEffect(() => {
    if (!roomCode || userRole !== 'teacher') return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const fb = await getFirebaseModule();
        if (!fb || !fb.isFirebaseConfigured()) return;

        cleanup = fb.listenToRoomData(roomCode, (firebaseData) => {
          if (!firebaseData) return;
          
          const firebaseJson = JSON.stringify(firebaseData);
          if (firebaseJson !== lastDataJsonRef.current) {
            isReceivingRef.current = true;
            
            const localApiKey = data.settings.apiKey;
            const mergedData: AppData = {
              ...firebaseData,
              settings: {
                ...firebaseData.settings,
                apiKey: localApiKey
              }
            };
            
            setData(mergedData);
            lastDataJsonRef.current = JSON.stringify(mergedData);
            
            setTimeout(() => {
              isReceivingRef.current = false;
            }, 100);
          }
        });
      } catch (e) {
        console.error('Teacher listener error:', e);
      }
    })();

    return () => { if (cleanup) cleanup(); };
  }, [roomCode, userRole]);

  return {
    isConnected,
    isSyncing,
    lastSyncTime,
    syncError
  };
}
