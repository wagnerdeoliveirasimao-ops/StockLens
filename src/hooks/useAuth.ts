import { useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase';

const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

export function useAuth() {
  const [user, setUser]               = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError]     = useState<string | null>(null);

  useEffect(() => {
    // Só finaliza o loading quando AMBOS terminarem:
    // - getRedirectResult (processa redirect pendente do Google)
    // - onAuthStateChanged (estado inicial do Firebase)
    // Isso evita o flash da tela de login enquanto o redirect é processado.

    let redirectDone  = false;
    let authStateDone = false;
    let resolvedUser: FirebaseUser | null = null;
    let settled = false;

    const safetyTimer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setAuthLoading(false);
      }
    }, 10000);

    const finalize = () => {
      if (!redirectDone || !authStateDone || settled) return;
      settled = true;
      clearTimeout(safetyTimer);
      setUser(resolvedUser);
      setAuthLoading(false);
    };

    // Listener principal — atualiza user após o carregamento inicial também
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      resolvedUser = u;
      if (settled) {
        // Já inicializado: atualiza diretamente (logout, etc.)
        setUser(u);
      } else {
        authStateDone = true;
        finalize();
      }
    });

    // Processa redirect pendente (volta do Google OAuth)
    getRedirectResult(auth)
      .then((_result) => {
        // resultado processado pelo onAuthStateChanged
      })
      .catch((err: { code?: string; message?: string }) => {
        if (err.code && err.code !== 'auth/cancelled-popup-request') {
          setAuthError(`Erro ao autenticar: ${err.code}`);
        }
      })
      .finally(() => {
        redirectDone = true;
        finalize();
      });

    // Pageshow: captura restauração de bfcache do iOS
    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        getRedirectResult(auth)
          .then((result) => {
            if (result?.user) {
              setUser(result.user);
              setAuthError(null);
            }
          })
          .catch((err: { code?: string }) => {
            if (err.code && err.code !== 'auth/cancelled-popup-request') {
              setAuthError(`Erro ao autenticar: ${err.code}`);
            }
          });
      }
    };
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
      window.removeEventListener('pageshow', handlePageShow);
    };

    // cleanup movido para dentro do handler do pageshow acima
  }, []);

  const login = () => {
    // Nota: sem await nem async aqui.
    // Qualquer operação assíncrona antes de signInWithPopup
    // quebra a cadeia de gesto do usuário no Safari e o popup é bloqueado.
    setAuthError(null);

    if (isMobile) {
      // iOS (Safari e Chrome) — redirect é mais confiável que popup
      signInWithRedirect(auth, googleProvider).catch((err: { code?: string }) => {
        if (err.code === 'auth/unauthorized-domain') {
          setAuthError(
            `Domínio não autorizado: adicione "${window.location.hostname}" em ` +
            `Authentication → Settings → Authorized domains no Firebase Console.`
          );
        }
      });
    } else {
      // Desktop — popup abre na mesma sessão, mais fluido
      signInWithPopup(auth, googleProvider).catch((err: { code?: string }) => {
        if (err.code === 'auth/popup-blocked') {
          signInWithRedirect(auth, googleProvider);
        } else if (err.code === 'auth/unauthorized-domain') {
          setAuthError(
            `Domínio não autorizado: adicione "${window.location.hostname}" em ` +
            `Authentication → Settings → Authorized domains no Firebase Console.`
          );
        } else if (err.code !== 'auth/cancelled-popup-request' && err.code !== 'auth/popup-closed-by-user') {
          console.error('[Auth] Login error:', err);
        }
      });
    }
  };

  const logout = async () => {
    await signOut(auth);
  };

  return { user, authLoading, authError, login, logout };
}
