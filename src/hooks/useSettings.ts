import { useState, useEffect } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UserSettings, OperationType } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { ToastType } from '../components/Toast';

export function useSettings(
  user: FirebaseUser | null,
  addToast: (message: string, type?: ToastType) => void
) {
  const [settings, setSettings] = useState<UserSettings>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'user_settings', user.uid), (snap) => {
      if (snap.exists()) setSettings(snap.data() as UserSettings);
    });
    return () => unsubscribe();
  }, [user]);

  const saveSettings = async (newSettings: UserSettings) => {
    if (!user) return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'user_settings', user.uid), newSettings, { merge: true });
      setSettings(newSettings);
      addToast('Configurações salvas com sucesso!');
    } catch (err) {
      addToast('Erro ao salvar configurações.', 'error');
      handleFirestoreError(err, OperationType.WRITE, `user_settings/${user.uid}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  return { settings, isSavingSettings, saveSettings };
}
