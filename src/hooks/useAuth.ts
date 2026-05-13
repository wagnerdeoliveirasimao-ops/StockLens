import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
  browserLocalPersistence,
  setPersistence,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

export function useAuth() {
  const [user, setUser]               = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError]     = useState<string | null>(null);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      console.warn('[Auth] Safety timeout — desbloqueando tela');
      setAuthLoading(false);
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      clearTimeout(safetyTimer);
      setUser(u);
      setAuthLoading(false);
    });

    // Captura resultado de redirect pendente (fallback para quando popup falhou)
    getRedirectResult(auth)
      .then((result) => {
        if (result?.user) console.log('[Auth] Redirect OK:', result.user.email);
      })
      .catch((err: { code?: string; message?: string }) => {
        console.error('[Auth] Redirect error:', err.code, err.message);
        clearTimeout(safetyTimer);
        if (err.code === 'auth/unauthorized-domain') {
          setAuthError(
            `Domínio não autorizado: adicione "${window.location.hostname}" em ` +
            `Authentication → Settings → Authorized domains no Firebase Console.`
          );
        }
        setAuthLoading(false);
      });

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const login = async () => {
    setAuthError(null);
    try {
      // Força persistência local (ajuda o Safari manter sessão entre redirects)
      await setPersistence(auth, browserLocalPersistence);
      // Popup funciona no iOS Safari quando o domínio está autorizado
      // e é chamado diretamente de um gesto do usuário
      await signInWithPopup(auth, googleProvider);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;

      if (code === 'auth/popup-blocked' || code === 'auth/popup-closed-by-user') {
        // Safari bloqueou o popup — cai para redirect
        console.log('[Auth] Popup bloqueado, tentando redirect...');
        try {
          await signInWithRedirect(auth, googleProvider);
        } catch (redirectErr: unknown) {
          const rCode = (redirectErr as { code?: string }).code;
          if (rCode === 'auth/unauthorized-domain') {
            setAuthError(
              `Domínio não autorizado: adicione "${window.location.hostname}" em ` +
              `Authentication → Settings → Authorized domains no Firebase Console.`
            );
          } else {
            console.error('[Auth] Redirect error:', redirectErr);
          }
        }
      } else if (code === 'auth/unauthorized-domain') {
        setAuthError(
          `Domínio não autorizado: adicione "${window.location.hostname}" em ` +
          `Authentication → Settings → Authorized domains no Firebase Console.`
        );
      } else if (code !== 'auth/cancelled-popup-request') {
        console.error('[Auth] Login error:', err);
      }
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, authLoading, authError, login, logout };
}
