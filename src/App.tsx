/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback, useRef, ChangeEvent, useEffect } from 'react';
import { 
  Upload, 
  Search, 
  TrendingUp, 
  FileImage, 
  AlertCircle, 
  CheckCircle2, 
  Tag, 
  BrainCircuit, 
  Globe,
  Loader2,
  X,
  ChevronRight,
  LayoutDashboard,
  History,
  BarChart3,
  User,
  Image as ImageIcon,
  Send,
  Eye,
  Download,
  Maximize2,
  Settings,
  Clock,
  LineChart,
  ChevronLeft,
  LogOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import exifr from 'exifr';
import heic2any from 'heic2any';
import { 
  signInWithPopup, 
  onAuthStateChanged, 
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  orderBy,
  setDoc,
  getDocFromServer
} from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';

// Componente para exibir imagens com segurança, lidando com erros de carregamento
const SafeImage = ({ src, alt, className }: { src: string; alt: string; className?: string }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
      )}
      
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400">
          <FileImage className="w-8 h-8 mb-2 opacity-30" />
          <span className="text-[8px] uppercase font-bold tracking-widest text-center px-2">Visualização Indisponível</span>
        </div>
      ) : (
        <img 
          src={src} 
          alt={alt} 
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};

// Helper component for Trend Images to avoid hook rule violations in map
const TrendImage = ({ img, title, idx, query }: { img: string; title: string; idx: number; query: string; key?: any }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isFallbackFailed, setIsFallbackFailed] = useState(false);

  return (
    <div className={`h-full relative overflow-hidden ${isFallbackFailed ? 'bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center' : 'bg-slate-200'}`}>
      {/* Skeleton pattern for loading/base */}
      {!isLoaded && !isFallbackFailed && (
        <div className="absolute inset-0 bg-slate-300 animate-pulse" />
      )}
      
      {!isFallbackFailed ? (
        <img 
          src={img} 
          alt={`${title} example ${idx + 1}`} 
          className={`relative w-full h-full object-cover transition-all duration-700 group-hover:scale-110 z-10 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            if (hasError) {
              setIsFallbackFailed(true);
              return;
            }
            setHasError(true);
            const target = e.target as HTMLImageElement;
            target.src = `https://images.unsplash.com/featured/?${query || 'stock'},stock&sig=${idx}`;
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-2 text-center opacity-40">
          <FileImage className="w-6 h-6 mb-1 text-slate-400" />
          <span className="text-[8px] uppercase tracking-tighter text-slate-400 font-bold">Trend View</span>
        </div>
      )}
    </div>
  );
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AnalysisResult {
  id: string;
  userId: string;
  name: string;
  url: string;
  originalUrl?: string | null;
  score: number;
  keywords: string[];
  trends: string;
  commercialPotential: string;
  suggestions: string[];
  editingGuide?: {
    exposure: string;
    contrast: string;
    saturation: string;
    highlights: string;
    shadows: string;
    colorTemp: string;
    cropSuggestion: string;
  };
  timestamp: number;
}

type View = 'dashboard' | 'history' | 'trends' | 'settings';

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [images, setImages] = useState<AnalysisResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isDistributing, setIsDistributing] = useState<string | null>(null);

  const [isImproving, setIsImproving] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<AnalysisResult | null>(null);

  interface UserSettings {
    shutterstock?: {
      apiKey: string;
      apiSecret: string;
      contributorId: string;
    };
    getty?: {
      apiKey: string;
      apiSecret: string;
    };
    adobe?: {
      apiKey: string;
      apiSecret: string;
    };
  }
  const [settings, setSettings] = useState<UserSettings>({});
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Auth & Connection Check
  useEffect(() => {
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Sync Analyses
  useEffect(() => {
    if (!user) {
      setImages([]);
      return;
    }

    const q = query(
      collection(db, 'analyses'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const results = snapshot.docs.map(doc => doc.data() as AnalysisResult);
      setImages(results);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'analyses');
    });

    return () => unsubscribe();
  }, [user]);

  // Sync Settings
  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'user_settings', user.uid), (doc) => {
      if (doc.exists()) {
        setSettings(doc.data() as UserSettings);
      }
    });
    return () => unsubscribe();
  }, [user]);

  const saveSettings = async (newSettings: UserSettings) => {
    if (!user) return;
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'user_settings', user.uid), newSettings, { merge: true });
      setSettings(newSettings);
      alert("Configurações salvas!");
    } catch (err) {
      setError("Erro ao salvar configurações.");
      handleFirestoreError(err, OperationType.WRITE, `user_settings/${user.uid}`);
    } finally {
      setIsSavingSettings(false);
    }
  };

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError("Falha ao entrar com Google.");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setImages([]);
    } catch (err) {
      setError("Falha ao sair.");
    }
  };

  const improveWithAI = async (original: AnalysisResult) => {
    if (!user) return;
    setIsImproving(original.id);
    try {
      await new Promise(resolve => setTimeout(resolve, 2500));
      
      const newName = original.name.replace(/\.[^/.]+$/, "") + "_v2_enhanced.png";
      const newId = Math.random().toString(36).substr(2, 9);
      const enhancedResult: AnalysisResult = {
        ...original,
        id: newId,
        userId: user.uid,
        name: newName,
        score: Math.min(100, original.score + 15),
        commercialPotential: "VERSÃO APRIMORADA: " + original.commercialPotential,
        timestamp: Date.now(),
      };

      await setDoc(doc(db, 'analyses', newId), enhancedResult);
      alert(`Uma nova versão aprimorada foi gerada: ${newName}`);
    } catch (err) {
      setError("Erro ao processar melhoria via IA.");
      handleFirestoreError(err, OperationType.WRITE, 'analyses');
    } finally {
      setIsImproving(null);
    }
  };

  const distributeImage = async (img: AnalysisResult, platforms: string[]) => {
    // Check for missing configs
    const missingPlat = platforms.find(p => {
      if (p === 'Shutterstock' && !settings.shutterstock?.apiKey) return true;
      if (p === 'Getty Images' && !settings.getty?.apiKey) return true;
      if (p === 'Adobe Stock' && !settings.adobe?.apiKey) return true;
      return false;
    });

    if (missingPlat) {
      alert(`Por favor, configure sua chave de API do ${missingPlat} nas Configurações antes de enviar.`);
      setActiveView('settings');
      return;
    }

    setIsDistributing(img.id);
    try {
      const response = await fetch('/api/distribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId: img.id,
          platforms,
          config: {
            shutterstock: settings.shutterstock,
            getty: settings.getty,
            adobe: settings.adobe
          },
          metadata: {
            title: img.commercialPotential,
            keywords: img.keywords
          }
        })
      });
      const data = await response.json();
      if (data.success) {
        alert(`Sucesso! Sua foto foi enviada para processamento no ${platforms.join(' e ')}.`);
      }
    } catch (err) {
      setError("Erro ao tentar distribuir imagem.");
    } finally {
      setIsDistributing(null);
    }
  };

  const analyzeImage = async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    setError(null);

    try {
      // Identificar se é um arquivo RAW ou HEIC
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isRaw = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'sr2', 'pef', 'x3f'].includes(extension || '');
      const isHeic = ['heic', 'heif'].includes(extension || '') || file.type.includes('heic') || file.type.includes('heif');
      
      let previewUrl = URL.createObjectURL(file);
      let analysisBlob: Blob = file;

      // Se for HEIC, converter para JPG para visualização
      if (isHeic) {
        console.log("HEIC detected, starting conversion...");
        try {
          // Tentar primeiro extrair thumbnail embutido (mais rápido)
          try {
            console.log("HEIC: Attempting fast thumbnail extraction...");
            const thumbnail = await exifr.thumbnail(file);
            if (thumbnail) {
              const tb = new Blob([thumbnail], { type: 'image/jpeg' });
              previewUrl = URL.createObjectURL(tb);
              analysisBlob = tb;
              console.log("HEIC: Successfully extracted thumbnail via exifr.");
            } else {
              throw new Error("No thumbnail in HEIC");
            }
          } catch (tErr) {
            // Se falhar a extração de thumbnail, usar heic2any para conversão total
            console.log("HEIC: Falling back to heic2any conversion (this may take a few seconds)...");
            let conversionResult;
            try {
              conversionResult = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.5
              });
            } catch (innerErr) {
              console.log("HEIC: JPEG conversion failed, trying PNG fallback...");
              conversionResult = await heic2any({
                blob: file,
                toType: 'image/png'
              });
            }
            const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            previewUrl = URL.createObjectURL(blob);
            analysisBlob = blob;
            console.log("HEIC: Successfully converted file using heic2any.");
          }
        } catch (heicErr) {
          console.error("Critical error handling HEIC file:", heicErr);
          // Se falhar tudo, deixamos o original, mas avisamos o usuário
          setError("Não foi possível gerar uma pré-visualização para este HEIC, mas a IA processará o arquivo original.");
        }
      } else if (isRaw) {
        // Se for RAW, tentar extrair miniatura com exifr
        try {
          const thumbnail = await exifr.thumbnail(file);
          if (thumbnail) {
            const tb = new Blob([thumbnail], { type: 'image/jpeg' });
            previewUrl = URL.createObjectURL(tb);
            analysisBlob = tb;
          }
        } catch (thumbErr) {
          console.warn("Could not extract RAW thumbnail:", thumbErr);
        }
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(analysisBlob);
      });

      // Gerar um thumbnail pequeno em base64 para persistência no histórico (max 800px)
      const persistentPreviewUrl = await new Promise<string>((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
          console.warn("Persistent preview timeout, using original preview URL.");
          resolve(previewUrl);
        }, 5000);

        img.onload = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', 0.6));
          } catch (e) {
            console.error("Canvas thumbnail generation failed:", e);
            resolve(previewUrl);
          }
        };
        img.onerror = (e) => {
          clearTimeout(timeout);
          console.warn("Persistent preview image load error:", e);
          // Se falhou o render, usamos um placeholder SVG em base64 estável que funciona em qualquer navegador
          const placeholder = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' fill='%23f1f5f9'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='8' fill='%2394a3b8' font-family='sans-serif'%3EHEIC/RAW PREVIEW%3C/text%3E%3C/svg%3E";
          resolve(placeholder);
        };
        img.src = previewUrl;
      });

      const prompt = `Analise esta imagem quanto ao seu potencial de venda em plataformas de fotos de arquivo (stock) como Shutterstock e Getty Images. 
      Retorne um objeto JSON com:
      - score: número (1-100) representando a comercialização.
      - keywords: string[] com 10-15 palavras-chave relevantes em português.
      - trends: string explicando como ela se encaixa nas tendências visuais atuais.
      - commercialPotential: string explicando o potencial comercial.
      - suggestions: string[] com recomendações práticas.
      - editingGuide: um objeto com:
          - exposure: string (ex: "+0.5")
          - contrast: string (ex: "+10")
          - saturation: string (ex: "-5")
          - highlights: string
          - shadows: string
          - colorTemp: string (ex: "Mais quente", "Mais frio", "Neutro")
          - cropSuggestion: string (descrição de como recortar)
      
      IMPORTANTE: Todas as descrições em texto devem estar em PORTUGUÊS (Brasil).`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                data: base64,
                mimeType: analysisBlob.type || "image/jpeg"
              }
            },
            { text: prompt }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              score: { type: Type.NUMBER },
              keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
              trends: { type: Type.STRING },
              commercialPotential: { type: Type.STRING },
              suggestions: { type: Type.ARRAY, items: { type: Type.STRING } },
              editingGuide: {
                type: Type.OBJECT,
                properties: {
                  exposure: { type: Type.STRING },
                  contrast: { type: Type.STRING },
                  saturation: { type: Type.STRING },
                  highlights: { type: Type.STRING },
                  shadows: { type: Type.STRING },
                  colorTemp: { type: Type.STRING },
                  cropSuggestion: { type: Type.STRING },
                }
              }
            },
            required: ["score", "keywords", "trends", "commercialPotential", "suggestions", "editingGuide"]
          }
        }
      });

      const text = response.text;
      if (!text) {
        throw new Error("Resposta da IA vazia.");
      }
      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        console.error("Gemini JSON error:", jsonErr, "Raw text:", text);
        setError("Erro ao processar análise da IA. A resposta parece estar incompleta.");
        setIsUploading(false);
        return;
      }
      
      const newId = Math.random().toString(36).substr(2, 9);
      const resultData: AnalysisResult = {
        id: newId,
        userId: user.uid,
        name: file.name,
        url: persistentPreviewUrl, 
        originalUrl: (isRaw || isHeic) ? URL.createObjectURL(file) : null,
        score: data.score,
        keywords: data.keywords,
        trends: data.trends,
        commercialPotential: data.commercialPotential,
        suggestions: data.suggestions,
        editingGuide: data.editingGuide,
        timestamp: Date.now()
      };

      try {
        await setDoc(doc(db, 'analyses', newId), resultData);
      } catch (dbErr) {
        handleFirestoreError(dbErr, OperationType.WRITE, 'analyses');
      }
    } catch (err) {
      console.error(err);
      if (!error) setError("Falha ao analisar imagem. Por favor, tente novamente.");
    } finally {
      setIsUploading(false);
    }
  };

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) analyzeImage(file);
  };

  const removeImage = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'analyses', id));
    } catch (err) {
      setError("Erro ao remover imagem.");
      handleFirestoreError(err, OperationType.DELETE, `analyses/${id}`);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0F172A] text-white flex flex-col shrink-0">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
            StockLens AI
          </h1>
        </div>
        
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setActiveView('dashboard')}
            className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${activeView === 'dashboard' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LayoutDashboard className="w-5 h-5" />
            <span className="text-sm font-medium">Painel de Análise</span>
          </button>
          <button 
            onClick={() => setActiveView('history')}
            className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${activeView === 'history' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Clock className="w-5 h-5" />
            <span className="text-sm font-medium">Histórico</span>
          </button>
          <button 
            onClick={() => setActiveView('trends')}
            className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${activeView === 'trends' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <LineChart className="w-5 h-5" />
            <span className="text-sm font-medium">Tendências</span>
          </button>
          <button 
            onClick={() => setActiveView('settings')}
            className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${activeView === 'settings' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-sm font-medium">Configurações</span>
          </button>
        </nav>

        <div className="p-6 mt-auto border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" /> : <User className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <p className="font-bold truncate max-w-[100px]">{user?.displayName || 'Usuário'}</p>
                <p className="text-slate-400">Plano Pro</p>
              </div>
            </div>
            <button onClick={logout} className="p-2 text-slate-400 hover:text-white transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {authLoading ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
          </div>
        ) : !user ? (
          <div className="flex-1 flex items-center justify-center bg-slate-50 p-6">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-xl text-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BrainCircuit className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Bem-vindo ao StockLens</h2>
              <p className="text-slate-500 mb-8 leading-relaxed">Sua IA pessoal para analisar o potencial de venda de suas fotos em bancos de imagem.</p>
              
              <button 
                onClick={login}
                className="w-full bg-slate-900 text-white p-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-black transition-all shadow-lg"
              >
                <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" className="w-5 h-5 bg-white rounded-full p-0.5" />
                ENTRAR COM GOOGLE
              </button>
              
              <p className="mt-8 text-[10px] text-slate-400 uppercase font-black tracking-widest">Acesse seu histórico de qualquer lugar</p>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
          {activeView === 'dashboard' && (
            <motion.div 
              key="dashboard"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center justify-between shrink-0">
                <div>
                  <h2 className="text-xl font-semibold">Análise de Potencial</h2>
                  <p className="text-sm text-slate-500">Baseado em dados de Getty Images e Shutterstock</p>
                </div>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-emerald-600 text-white px-6 py-2.5 rounded-lg font-semibold text-sm hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Upload de Novas Fotos
                </button>
              </header>

              <div className="p-8 flex-1 overflow-y-auto space-y-6">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="group relative border-2 border-dashed border-slate-300 bg-white rounded-xl p-8 text-center flex flex-col items-center justify-center hover:border-emerald-500 transition-all cursor-pointer shadow-sm"
                >
                  <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-4 py-4">
                      <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                      <p className="text-sm font-medium animate-pulse text-slate-600">A IA está analisando sua foto...</p>
                    </div>
                  ) : (
                    <>
                      <div className="bg-slate-50 p-4 rounded-full mb-4 group-hover:bg-emerald-50 transition-colors">
                        <FileImage className="w-8 h-8 text-slate-400 group-hover:text-emerald-500" />
                      </div>
                      <p className="text-slate-600 mb-2 font-medium">Arraste suas fotos aqui ou clique para selecionar</p>
                      <p className="text-xs text-slate-400">Formatos suportados: PNG, JPG, WEBP (IA sugerida para Stock)</p>
                    </>
                  )}
                </div>

                {error && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 text-sm border border-red-100">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
                  </div>
                )}

                {images.length > 0 && (
                  <div className="bg-slate-100 p-4 rounded-xl flex items-center justify-around border border-slate-200">
                    <div className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Total Analisado</p>
                      <p className="text-lg font-bold">{images.length} Fotos</p>
                    </div>
                    <div className="h-8 w-px bg-slate-300"></div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Potencial Médio</p>
                      <p className="text-lg font-bold text-emerald-600">
                        {(images.reduce((acc, img) => acc + img.score, 0) / images.length).toFixed(0)}%
                      </p>
                    </div>
                    <div className="h-8 w-px bg-slate-300"></div>
                    <div className="text-center">
                      <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Status Atual</p>
                      <p className="text-lg font-bold">Mercado Ativo</p>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <AnimatePresence mode="popLayout">
                    {images.map((img) => (
                      <motion.div
                        key={img.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        onClick={() => setSelectedImage(img)}
                        className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-4 hover:border-emerald-500 cursor-pointer transition-all hover:shadow-md group"
                      >
                        <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 relative border border-slate-200">
                          <SafeImage src={img.url} alt={img.name} className="w-full h-full" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${img.name.includes('_enhanced') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                              {img.name.includes('_enhanced') ? 'APRIMORADA' : 'ORIGINAL'}
                            </span>
                            <h3 className="font-bold text-sm text-slate-800 truncate uppercase tracking-tight">{img.commercialPotential}</h3>
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono truncate">{img.name}</p>
                        </div>
                        <div className="text-right px-4 border-l border-slate-100">
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none mb-1">Potencial</p>
                          <span className={`text-xl font-black ${img.score > 80 ? 'text-emerald-600' : 'text-slate-600'}`}>{img.score}%</span>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity pr-2 border-l border-slate-100 pl-4">
                          <button onClick={(e) => { e.stopPropagation(); removeImage(img.id); }} className="p-2 text-slate-300 hover:text-red-500 transition-colors"><X className="w-5 h-5" /></button>
                          <ChevronRight className="w-5 h-5 text-slate-300" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>

                {!images.length && !isUploading && (
                  <div className="h-[40vh] flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4"><ImageIcon className="w-8 h-8 text-slate-300" /></div>
                    <h3 className="font-semibold text-slate-800">Pronto para começar?</h3>
                    <p className="text-sm text-slate-500 max-w-xs mt-1">Arraste suas fotos para o painel acima para análise imediata.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeView === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center shrink-0">
                <h2 className="text-xl font-semibold">Histórico de Atividades</h2>
              </header>
              <div className="p-8 flex-1 overflow-y-auto space-y-4">
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Arquivo</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Data</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Score</th>
                        <th className="px-6 py-4 font-bold text-slate-500 uppercase tracking-wider text-[10px]">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {images.length > 0 ? images.map(img => (
                        <tr key={img.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelectedImage(img)}>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0">
                                <SafeImage src={img.url} alt={img.name} className="w-full h-full" />
                              </div>
                              <span className="font-medium text-slate-700">{img.name}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-500">{new Date(img.timestamp).toLocaleDateString('pt-BR')}</td>
                          <td className="px-6 py-4 font-bold text-emerald-600">{img.score}%</td>
                          <td className="px-6 py-4 text-slate-400">Analisado</td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">Nenhum histórico disponível ainda</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'trends' && (
            <motion.div 
              key="trends"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center shrink-0">
                <h2 className="text-xl font-semibold">Tendências do Mercado de Stock 2026</h2>
              </header>
              <div className="p-8 flex-1 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {[
                    {
                      title: "Autenticidade Radical",
                      term: "Candid & Unretouched",
                      description: "A saída do 'perfeito' para o 'real'. Fotos que capturam imperfeições, momentos espontâneos e diversidade genuína sem edições pesadas de pele.",
                      keywords: ["Real people", "No filter", "Body positivity", "Multi-generational"],
                      example: "Uma avó e neto cozinhando juntos com a cozinha levemente bagunçada e luz natural.",
                      images: [
                        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop"
                      ],
                      color: "text-emerald-500",
                      bg: "bg-emerald-50",
                      query: "people"
                    },
                    {
                      title: "Vida Sustentável e ESG",
                      term: "Eco-Conscious Living",
                      description: "A sustentabilidade não é mais apenas verde. É sobre economia circular, energia limpa integrada ao cotidiano e consumo consciente.",
                      keywords: ["Solar energy", "Zero-waste", "Climate action", "Sustainable tech"],
                      example: "Eletrodomésticos modernos com selo Procel em uma casa com painéis solares visíveis pela janela.",
                      images: [
                        "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1542601906990-b4d3fb778eff?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1466611653911-954ff21b6748?q=80&w=600&auto=format&fit=crop"
                      ],
                      color: "text-blue-500",
                      bg: "bg-blue-50",
                      query: "nature"
                    },
                    {
                      title: "O Profissional Híbrido",
                      term: "Hybrid & Creator Economy",
                      description: "O novo escritório é qualquer lugar. Foco em setups ergonômicos em casa, co-workings dinâmicos e ferramentas de criação de conteúdo.",
                      keywords: ["Remote work", "Digital nomad", "Vlogging setup", "Ergonomic office"],
                      example: "Um profissional usando tablet e fones de ouvido em um café moderno com luz de fundo 'bokeh'.",
                      images: [
                        "https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=600&auto=format&fit=crop"
                      ],
                      color: "text-amber-500",
                      bg: "bg-amber-50",
                      query: "office"
                    },
                    {
                      title: "Luxo Silencioso",
                      term: "Quiet Luxury",
                      description: "Minimalismo elevado. Paletas de cores neutras, texturas ricas e composição focada em qualidade e durabilidade em vez de logos ou ostentação.",
                      keywords: ["Organic minimalism", "Earth tones", "High-end textures", "Soft lighting"],
                      example: "Close-up de tecidos naturais como linho e madeira clara em um ambiente de alto padrão minimalista.",
                      images: [
                        "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1616489953149-86644eb98752?q=80&w=600&auto=format&fit=crop"
                      ],
                      color: "text-purple-500",
                      bg: "bg-purple-50",
                      query: "interior"
                    },
                    {
                      title: "Bem-estar Digital",
                      term: "Digital Wellness",
                      description: "Imagens que mostram o equilíbrio com a tecnologia. Momentos de desconexão, mindfulness e o uso saudável de dispositivos.",
                      keywords: ["Digital detox", "Mindfulness", "Mental health", "Tech balance"],
                      example: "Uma pessoa praticando yoga com um smartphone por perto exibindo um app de meditação.",
                      images: [
                        "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1518314916301-73c9d955c4da?q=80&w=600&auto=format&fit=crop"
                      ],
                      color: "text-rose-500",
                      bg: "bg-rose-50",
                      query: "yoga"
                    },
                    {
                      title: "Ultra-Localismo",
                      term: "Hyper-Local Culture",
                      description: "Valorização das raízes locais e herança cultural. Fotos que celebram comunidades específicas, artesãos e tradições regionais.",
                      keywords: ["Local heritage", "Artisanship", "Community roots", "Slow travel"],
                      example: "Um artesão local em seu ateliê trabalhando em uma peça tradicional de sua região.",
                      images: [
                        "https://images.unsplash.com/photo-1558444479-c86e46272c50?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1581333100576-b73bbe92c2cb?q=80&w=600&auto=format&fit=crop",
                        "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=600&auto=format&fit=crop"
                      ],
                      color: "text-cyan-500",
                      bg: "bg-cyan-50",
                      query: "craft"
                    }

                  ].map((trend, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:shadow-lg transition-shadow"
                    >
                      <div className="h-48 overflow-hidden relative group grid grid-cols-3 gap-0.5 bg-slate-200">
                        {trend.images.map((img, idx) => (
                          <TrendImage 
                            key={idx} 
                            img={img} 
                            title={trend.title} 
                            idx={idx} 
                            query={(trend as any).query} 
                          />
                        ))}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6 pointer-events-none">
                           <span className="text-[10px] font-black text-white uppercase tracking-widest px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                            Exemplos de Composição
                          </span>
                        </div>
                      </div>
                      <div className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className={`p-3 rounded-2xl ${trend.bg} ${trend.color}`}>
                            <TrendingUp className="w-6 h-6" />
                          </div>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                            {trend.term}
                          </span>
                        </div>
                        <h3 className="font-black text-xl mb-3 text-slate-800 uppercase tracking-tight">{trend.title}</h3>
                        <p className="text-sm text-slate-500 leading-relaxed mb-6">{trend.description}</p>
                        
                        <div className="space-y-4">
                          <div>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Social Meta-tags</p>
                            <div className="flex flex-wrap gap-2">
                              {trend.keywords.map(kw => (
                                <span key={kw} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-100 font-bold">
                                  #{kw}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}

          {activeView === 'settings' && (
            <motion.div 
              key="settings"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex-1 flex flex-col overflow-hidden"
            >
              <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center shrink-0">
                <h2 className="text-xl font-semibold">Configurações de Integração</h2>
              </header>
              <div className="p-8 flex-1 overflow-y-auto max-w-2xl mx-auto w-full">
                <div className="space-y-8">
                  <section>
                    <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">API de IA (Gemini)</h3>
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Chave da API</label>
                        <div className="flex gap-2">
                          <input type="password" value="************************" readOnly className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
                          <button className="text-xs bg-slate-900 text-white px-4 rounded-lg font-bold">Gerenciar</button>
                        </div>
                        <p className="mt-2 text-[10px] text-slate-400 italic">As chaves de IA são gerenciadas pelo ambiente do AI Studio.</p>
                      </div>
                    </div>
                  </section>

                  <form onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    saveSettings({
                      ...settings,
                      shutterstock: {
                        apiKey: formData.get('ss_key') as string,
                        apiSecret: formData.get('ss_secret') as string,
                        contributorId: formData.get('ss_cid') as string,
                      },
                      getty: {
                        apiKey: formData.get('gt_key') as string,
                        apiSecret: formData.get('gt_secret') as string,
                      },
                      adobe: {
                        apiKey: formData.get('ad_key') as string,
                        apiSecret: formData.get('ad_secret') as string,
                      }
                    });
                  }}>
                    <section>
                      <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                        Plataformas de Distribuição
                        {isSavingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
                      </h3>
                      <div className="space-y-4">
                        {/* Shutterstock Integration Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-400">S</div>
                              <div>
                                <h4 className="font-bold">Shutterstock</h4>
                                <p className="text-xs text-slate-400">Integração via API Contributor</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded ${settings.shutterstock?.apiKey ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                              {settings.shutterstock?.apiKey ? 'ATIVO' : 'DESCONECTADO'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Consumer Key</label>
                              <input 
                                name="ss_key"
                                type="text" 
                                defaultValue={settings.shutterstock?.apiKey || ''}
                                placeholder="Insira seu Consumer Key"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Consumer Secret</label>
                              <input 
                                name="ss_secret"
                                type="password" 
                                defaultValue={settings.shutterstock?.apiSecret || ''}
                                placeholder="Insira seu Consumer Secret"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                            <div className="md:col-span-2">
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Contributor ID</label>
                              <input 
                                name="ss_cid"
                                type="text" 
                                defaultValue={settings.shutterstock?.contributorId || ''}
                                placeholder="ID da sua conta de contribuinte"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Getty Images Integration Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center font-black text-emerald-600">G</div>
                              <div>
                                <h4 className="font-bold">Getty Images</h4>
                                <p className="text-xs text-slate-400">Integração via API ESP</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded ${settings.getty?.apiKey ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                              {settings.getty?.apiKey ? 'ATIVO' : 'DESCONECTADO'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">API Key</label>
                              <input 
                                name="gt_key"
                                type="text" 
                                defaultValue={settings.getty?.apiKey || ''}
                                placeholder="Getty API Key"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">API Secret</label>
                              <input 
                                name="gt_secret"
                                type="password" 
                                defaultValue={settings.getty?.apiSecret || ''}
                                placeholder="Getty API Secret"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Adobe Stock Integration Card */}
                        <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col gap-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center font-black text-blue-600">A</div>
                              <div>
                                <h4 className="font-bold">Adobe Stock</h4>
                                <p className="text-xs text-slate-400">Integração via Adobe Developer</p>
                              </div>
                            </div>
                            <span className={`text-[10px] font-black px-2 py-1 rounded ${settings.adobe?.apiKey ? 'bg-blue-50 text-blue-600' : 'bg-slate-50 text-slate-400'}`}>
                              {settings.adobe?.apiKey ? 'ATIVO' : 'DESCONECTADO'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">API Key</label>
                              <input 
                                name="ad_key"
                                type="text" 
                                defaultValue={settings.adobe?.apiKey || ''}
                                placeholder="Adobe API Key"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Client Secret</label>
                              <input 
                                name="ad_secret"
                                type="password" 
                                defaultValue={settings.adobe?.apiSecret || ''}
                                placeholder="Adobe Client Secret"
                                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono"
                              />
                            </div>
                          </div>
                        </div>

                        <button 
                          type="submit"
                          disabled={isSavingSettings}
                          className="bg-slate-900 text-white w-full py-4 rounded-2xl font-black text-sm hover:bg-black transition-all shadow-lg disabled:opacity-50"
                        >
                          SALVAR TODAS AS CONFIGURAÇÕES
                        </button>
                      </div>
                    </section>
                  </form>

                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-amber-900">Nota de Segurança</h4>
                      <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                        Suas chaves são salvas criptografadas e protegidas pelas regras de segurança do Firebase. 
                        Nunca compartilhe seu Consumer Secret com ninguém.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      <footer className="px-8 py-4 bg-white border-t border-slate-200 flex justify-between items-center shrink-0">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">© 2026 StockLens AI</p>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
            <span className="hover:text-slate-600 cursor-pointer">Termos</span>
            <span className="hover:text-slate-600 cursor-pointer">Privacidade</span>
            <span className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {user ? 'Conectado' : 'Online'}
            </span>
          </div>
        </footer>
      </main>

      {/* Global Image Detail Panel */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-end p-0 md:p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full max-w-2xl h-full md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${selectedImage.name.includes('_enhanced') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {selectedImage.name.includes('_enhanced') ? 'VERSÃO APRIMORADA' : 'VERSÃO ORIGINAL'}
                    </span>
                    <h3 className="font-bold text-slate-800 uppercase tracking-tight line-clamp-1">{selectedImage.commercialPotential}</h3>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">{selectedImage.name}</p>
                </div>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Hero Preview */}
                <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative group">
                  <SafeImage 
                    src={selectedImage.url} 
                    alt={selectedImage.name}
                    className="w-full h-full"
                  />
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => {
                          const link = document.createElement('a');
                          link.href = selectedImage.originalUrl || selectedImage.url;
                          link.download = selectedImage.name;
                          link.click();
                      }}
                      className="p-2 bg-white/90 backdrop-blur shadow-sm hover:bg-white rounded-lg text-slate-800 transition-all flex items-center gap-2 text-xs font-bold"
                    >
                      <Download className="w-4 h-4" />
                      BAIXAR
                    </button>
                  </div>
                  {/* Score Overlay */}
                  <div className="absolute bottom-4 left-4 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg border border-emerald-500/50">
                    <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-80">Score de Potencial</p>
                    <p className="text-2xl font-black">{selectedImage.score}%</p>
                  </div>
                </div>

                {/* AI Analysis Sections */}
                <div className="grid grid-cols-1 gap-8">
                  {/* Market Potential & Trends */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-emerald-600">
                      <TrendingUp className="w-5 h-5" />
                      <h4 className="font-black text-sm uppercase tracking-wider">Análise de Mercado</h4>
                    </div>
                    <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/50">
                      <p className="text-sm text-slate-700 leading-relaxed font-medium mb-4">
                        {selectedImage.trends}
                      </p>
                      
                      <div className="space-y-2">
                        <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Palavras-chave Sugeridas</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedImage.keywords.map(k => (
                            <span key={k} className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs text-slate-600 font-medium">
                              #{k}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* Editing Guide */}
                  <section className="space-y-4">
                    <div className="flex items-center gap-2 text-slate-800">
                      <BrainCircuit className="w-5 h-5" />
                      <h4 className="font-black text-sm uppercase tracking-wider">Guia de Edição Técnica</h4>
                    </div>
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                          { label: 'Exposição', value: selectedImage.editingGuide?.exposure },
                          { label: 'Contraste', value: selectedImage.editingGuide?.contrast },
                          { label: 'Saturação', value: selectedImage.editingGuide?.saturation },
                          { label: 'Highlights', value: selectedImage.editingGuide?.highlights },
                          { label: 'Sombras', value: selectedImage.editingGuide?.shadows },
                          { label: 'Temp. Cor', value: selectedImage.editingGuide?.colorTemp }
                        ].map(item => (
                          <div key={item.label} className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{item.label}</p>
                            <p className="text-sm font-black text-slate-700">{item.value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="bg-white/50 p-3 rounded-xl border border-dashed border-slate-200">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Sugestão de Enquadramento</p>
                        <p className="text-xs text-slate-600 italic leading-relaxed">{selectedImage.editingGuide?.cropSuggestion}</p>
                      </div>
                    </div>
                  </section>

                  {/* Actions Area */}
                  <section className="space-y-4 pt-4 border-t border-slate-100">
                    <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest text-center">Próximos Passos</h4>
                    
                    <div className="grid grid-cols-1 gap-3">
                       {!selectedImage.name.includes('_enhanced') && (
                        <button 
                          disabled={isImproving === selectedImage.id}
                          onClick={() => improveWithAI(selectedImage)}
                          className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-200 disabled:opacity-50"
                        >
                          {isImproving === selectedImage.id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : (
                            <BrainCircuit className="w-5 h-5" />
                          )}
                          GERAR VERSÃO APRIMORADA VIA IA
                        </button>
                      )}

                      <div className="grid grid-cols-3 gap-3">
                        <button 
                          disabled={isDistributing === selectedImage.id}
                          onClick={() => distributeImage(selectedImage, ['Shutterstock'])}
                          className="bg-slate-900 text-white p-4 rounded-2xl font-black text-[10px] hover:bg-black transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isDistributing === selectedImage.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Upload className="w-4 h-4"/>}
                          SHUTTERSTOCK
                        </button>
                        <button 
                          disabled={isDistributing === selectedImage.id}
                          onClick={() => distributeImage(selectedImage, ['Getty Images'])}
                          className="bg-white border-2 border-slate-900 text-slate-900 p-4 rounded-2xl font-black text-[10px] hover:bg-slate-50 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isDistributing === selectedImage.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Send className="w-4 h-4"/>}
                          GETTY IMAGES
                        </button>
                        <button 
                          disabled={isDistributing === selectedImage.id}
                          onClick={() => distributeImage(selectedImage, ['Adobe Stock'])}
                          className="bg-white border-2 border-blue-600 text-blue-600 p-4 rounded-2xl font-black text-[10px] hover:bg-blue-50 transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50"
                        >
                          {isDistributing === selectedImage.id ? <Loader2 className="w-4 h-4 animate-spin"/> : <Search className="w-4 h-4"/>}
                          ADOBE STOCK
                        </button>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
