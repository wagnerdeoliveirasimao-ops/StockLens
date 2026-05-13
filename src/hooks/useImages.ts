import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import exifr from 'exifr';
import heic2any from 'heic2any';
import { db, storage } from '../firebase';
import { AnalysisResult, UserSettings, OperationType, View, BatchItem, ImageMetadata } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { ai, GEMINI_MODEL, ANALYSIS_PROMPT, analysisResponseSchema } from '../lib/gemini';
import { buildCompliance } from '../lib/compliance';
import { ToastType } from '../components/Toast';

export function useImages(
  user: FirebaseUser | null,
  addToast: (message: string, type?: ToastType) => void,
  settings: UserSettings,
  setActiveView: (v: View) => void
) {
  const [images, setImages] = useState<AnalysisResult[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isDistributing, setIsDistributing] = useState<string | null>(null);
  const [isImproving, setIsImproving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const cancelBatchRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const blobCacheRef = useRef<Map<string, Blob>>(new Map());

  useEffect(() => {
    if (!user) { setImages([]); return; }
    const q = query(
      collection(db, 'analyses'),
      where('userId', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setImages(snapshot.docs.map(d => d.data() as AnalysisResult));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'analyses');
    });
    return () => unsubscribe();
  }, [user]);

  const analyzeImage = useCallback(async (file: File) => {
    if (!user) return;
    setIsUploading(true);
    setError(null);

    try {
      const extension = file.name.split('.').pop()?.toLowerCase();
      const isRaw = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'sr2', 'pef', 'x3f'].includes(extension || '');
      const isHeic = ['heic', 'heif'].includes(extension || '') || file.type.includes('heic') || file.type.includes('heif');

      let previewUrl = URL.createObjectURL(file);
      let analysisBlob: Blob = file;

      if (isHeic) {
        try {
          try {
            const thumbnail = await exifr.thumbnail(file);
            if (thumbnail) {
              const tb = new Blob([thumbnail], { type: 'image/jpeg' });
              previewUrl = URL.createObjectURL(tb);
              analysisBlob = tb;
            } else throw new Error('No thumbnail in HEIC');
          } catch {
            let conversionResult;
            try {
              conversionResult = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.5 });
            } catch {
              conversionResult = await heic2any({ blob: file, toType: 'image/png' });
            }
            const blob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
            previewUrl = URL.createObjectURL(blob);
            analysisBlob = blob;
          }
        } catch (heicErr) {
          console.error('Critical error handling HEIC file:', heicErr);
          setError('Não foi possível gerar uma pré-visualização para este HEIC, mas a IA processará o arquivo original.');
        }
      } else if (isRaw) {
        try {
          const thumbnail = await exifr.thumbnail(file);
          if (thumbnail) {
            const tb = new Blob([thumbnail], { type: 'image/jpeg' });
            previewUrl = URL.createObjectURL(tb);
            analysisBlob = tb;
          }
        } catch { /* continua com o original */ }
      }

      // Extract image dimensions from EXIF or via Image element
      let imageMetadata: ImageMetadata | undefined;
      try {
        const exif = await exifr.parse(file, ['ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight', 'PixelXDimension', 'PixelYDimension']);
        const w = exif?.ImageWidth ?? exif?.ExifImageWidth ?? exif?.PixelXDimension;
        const h = exif?.ImageHeight ?? exif?.ExifImageHeight ?? exif?.PixelYDimension;
        if (w && h) {
          imageMetadata = { width: w, height: h, megapixels: (w * h) / 1_000_000 };
        }
      } catch { /* fallback below */ }

      if (!imageMetadata) {
        try {
          const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
            img.onerror = reject;
            img.src = previewUrl;
          });
          if (dims.w && dims.h) {
            imageMetadata = { width: dims.w, height: dims.h, megapixels: (dims.w * dims.h) / 1_000_000 };
          }
        } catch { /* no metadata available */ }
      }

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(analysisBlob);
      });

      const thumbnailBlob = await new Promise<Blob>((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => resolve(analysisBlob), 5000);
        img.onload = () => {
          clearTimeout(timeout);
          try {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800;
            let width = img.width, height = img.height;
            if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
            canvas.width = width; canvas.height = height;
            canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
            canvas.toBlob(b => resolve(b ?? analysisBlob), 'image/jpeg', 0.7);
          } catch { resolve(analysisBlob); }
        };
        img.onerror = () => { clearTimeout(timeout); resolve(analysisBlob); };
        img.src = previewUrl;
      });

      const newId = crypto.randomUUID();
      blobCacheRef.current.set(newId, thumbnailBlob);

      const thumbName = file.name.replace(/\.[^/.]+$/, '') + '_thumb.jpg';
      const storageRef = ref(storage, `users/${user.uid}/analyses/${newId}/${thumbName}`);
      const snapshot = await uploadBytes(storageRef, thumbnailBlob, { contentType: 'image/jpeg' });
      const persistentPreviewUrl = await getDownloadURL(snapshot.ref);
      const storagePath = snapshot.ref.fullPath;

      const response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: {
          parts: [
            { inlineData: { data: base64, mimeType: analysisBlob.type || 'image/jpeg' } },
            { text: ANALYSIS_PROMPT },
          ],
        },
        config: { responseMimeType: 'application/json', responseSchema: analysisResponseSchema },
      });

      const text = response.text;
      if (!text) throw new Error('Resposta da IA vazia.');

      let data;
      try {
        data = JSON.parse(text);
      } catch (jsonErr) {
        console.error('Gemini JSON error:', jsonErr, 'Raw text:', text);
        setError('Erro ao processar análise da IA. A resposta parece estar incompleta.');
        return;
      }

      const compliance = data.compliance ? buildCompliance(data.compliance, imageMetadata) : undefined;

      const resultData: AnalysisResult = {
        id: newId,
        userId: user.uid,
        name: file.name,
        url: persistentPreviewUrl,
        storagePath,
        originalUrl: (isRaw || isHeic) ? URL.createObjectURL(file) : null,
        score: data.score,
        keywords: data.keywords,
        trends: data.trends,
        commercialPotential: data.commercialPotential,
        suggestions: data.suggestions,
        editingGuide: data.editingGuide,
        compliance,
        imageMetadata,
        timestamp: Date.now(),
      };

      await setDoc(doc(db, 'analyses', newId), resultData);
    } catch (err) {
      console.error(err);
      if (!error) setError('Falha ao analisar imagem. Por favor, tente novamente.');
    } finally {
      setIsUploading(false);
    }
  }, [user, error]);

  const improveWithAI = useCallback(async (original: AnalysisResult) => {
    if (!user) return;
    setIsImproving(original.id);
    try {
      const guide = original.editingGuide;
      if (!guide) throw new Error('Guia de edição ausente.');

      const cachedBlob = blobCacheRef.current.get(original.id);
      if (!cachedBlob) throw new Error('Imagem não disponível em memória. Faça um novo upload da foto para gerar a versão aprimorada.');

      const localUrl = URL.createObjectURL(cachedBlob);
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = reject;
        el.src = localUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width;
      canvas.height = img.naturalHeight || img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imageData.data;
      const exposure = parseFloat(guide.exposure) || 0;
      const contrast = parseFloat(guide.contrast) || 0;
      const saturation = parseFloat(guide.saturation) || 0;
      const exposureFactor = Math.pow(2, exposure);
      const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

      for (let i = 0; i < d.length; i += 4) {
        let r = d[i], g = d[i + 1], b = d[i + 2];
        r = Math.min(255, r * exposureFactor);
        g = Math.min(255, g * exposureFactor);
        b = Math.min(255, b * exposureFactor);
        r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128));
        g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128));
        b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128));
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const sat = saturation / 100;
        r = Math.min(255, Math.max(0, lum + (r - lum) * (1 + sat)));
        g = Math.min(255, Math.max(0, lum + (g - lum) * (1 + sat)));
        b = Math.min(255, Math.max(0, lum + (b - lum) * (1 + sat)));
        d[i] = r; d[i + 1] = g; d[i + 2] = b;
      }
      ctx.putImageData(imageData, 0, 0);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas vazio')), 'image/jpeg', 0.92);
      });

      const newId = crypto.randomUUID();
      const newName = original.name.replace(/\.[^/.]+$/, '') + '_enhanced.jpg';
      const enhancedRef = ref(storage, `users/${user.uid}/analyses/${newId}/${newName}`);
      const snap = await uploadBytes(enhancedRef, blob, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(snap.ref);
      URL.revokeObjectURL(localUrl);

      const enhancedResult: AnalysisResult = {
        ...original,
        id: newId,
        userId: user.uid,
        name: newName,
        url: downloadUrl,
        storagePath: snap.ref.fullPath,
        originalUrl: original.url,
        score: Math.min(100, original.score + Math.round(Math.abs(exposure) * 3 + Math.abs(contrast) / 5)),
        commercialPotential: 'VERSÃO APRIMORADA: ' + original.commercialPotential,
        timestamp: Date.now(),
      };

      await setDoc(doc(db, 'analyses', newId), enhancedResult);
      addToast(`Versão aprimorada gerada: ${newName}`);
    } catch (err) {
      addToast('Erro ao processar melhoria via IA.', 'error');
      console.error(err);
    } finally {
      setIsImproving(null);
    }
  }, [user, addToast]);

  const distributeImage = useCallback(async (img: AnalysisResult, platforms: string[]) => {
    // Getty never needs API keys (no upload API) — skip key check for it
    const missingPlat = platforms.find(p => {
      if (p === 'Shutterstock' && !settings.shutterstock?.apiKey) return true;
      if (p === 'Adobe Stock'  && !settings.adobe?.apiKey)        return true;
      return false;
    });

    if (missingPlat) {
      addToast(`Configure a chave de API do ${missingPlat} nas Configurações antes de enviar.`, 'error');
      setActiveView('settings');
      return;
    }

    setIsDistributing(img.id);
    try {
      const response = await fetch('/api/distribute', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageId:   img.id,
          imageUrl:  img.url,
          imageName: img.name,
          platforms,
          config:   { shutterstock: settings.shutterstock, getty: settings.getty, adobe: settings.adobe },
          metadata: {
            title:       img.commercialPotential,
            keywords:    img.keywords,
            description: img.trends,
          },
        }),
      });

      const data = await response.json() as {
        success: boolean;
        message: string;
        details: Array<{ platform: string; status: string; message: string; submissionId?: string; portalUrl?: string }>;
      };

      // Show one toast per platform with status and relevant detail
      for (const result of data.details ?? []) {
        if (result.status === 'success') {
          const idSuffix = result.submissionId ? ` (ID: ${result.submissionId})` : '';
          addToast(`${result.platform}: ${result.message}${idSuffix}`);
        } else {
          // For Getty, include the portal URL in the message
          const portalHint = result.portalUrl ? ` → ${result.portalUrl}` : '';
          addToast(`${result.platform}: ${result.message}${portalHint}`, 'error');
        }
      }
    } catch {
      addToast('Erro de conexão ao tentar distribuir imagem.', 'error');
    } finally {
      setIsDistributing(null);
    }
  }, [settings, addToast, setActiveView]);

  const removeImage = useCallback(async (id: string, userId: string) => {
    try {
      await deleteDoc(doc(db, 'analyses', id));
      const img = images.find(i => i.id === id);
      if (img) {
        const base = img.name.replace(/\.[^/.]+$/, '');
        const folder = ref(storage, `users/${userId}/analyses/${id}`);
        for (const suffix of ['_thumb.jpg', '_enhanced.jpg']) {
          deleteObject(ref(folder, base + suffix)).catch(() => {});
        }
      }
    } catch (err) {
      setError('Erro ao remover imagem.');
      handleFirestoreError(err, OperationType.DELETE, `analyses/${id}`);
    }
  }, [images]);

  const analyzeBatch = useCallback(async (files: File[]) => {
    if (!user || files.length === 0) return;
    cancelBatchRef.current = false;

    const items: BatchItem[] = files.map(file => ({
      id: crypto.randomUUID(),
      file,
      name: file.name,
      status: 'queued',
    }));
    setBatch(items);

    let doneCount = 0;
    let errorCount = 0;

    for (let i = 0; i < items.length; i++) {
      if (cancelBatchRef.current) {
        setBatch(prev => prev.map((item, idx) =>
          idx >= i ? { ...item, status: 'error', error: 'Cancelado' } : item
        ));
        addToast(`Lote cancelado. ${doneCount} de ${items.length} fotos concluídas.`, 'error');
        break;
      }

      setBatch(prev => prev.map((item, idx) =>
        idx === i ? { ...item, status: 'analyzing' } : item
      ));

      try {
        await analyzeImage(items[i].file);
        doneCount++;
        setBatch(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'done' } : item
        ));
      } catch {
        errorCount++;
        setBatch(prev => prev.map((item, idx) =>
          idx === i ? { ...item, status: 'error', error: 'Falha na análise' } : item
        ));
      }

      // Pequena pausa entre requisições para evitar rate limit
      if (i < items.length - 1 && !cancelBatchRef.current) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!cancelBatchRef.current) {
      if (errorCount === 0) {
        addToast(`Lote concluído! ${doneCount} foto${doneCount > 1 ? 's' : ''} analisada${doneCount > 1 ? 's' : ''}.`);
      } else {
        addToast(`Lote concluído com ${errorCount} erro${errorCount > 1 ? 's' : ''}. ${doneCount} foto${doneCount > 1 ? 's' : ''} ok.`, 'error');
      }
    }
  }, [user, analyzeImage, addToast]);

  const cancelBatch = useCallback(() => {
    cancelBatchRef.current = true;
  }, []);

  const clearBatch = useCallback(() => {
    setBatch([]);
  }, []);

  const retryBatchItem = useCallback(async (itemId: string) => {
    const item = batch.find(b => b.id === itemId);
    if (!item) return;
    setBatch(prev => prev.map(b => b.id === itemId ? { ...b, status: 'analyzing', error: undefined } : b));
    try {
      await analyzeImage(item.file);
      setBatch(prev => prev.map(b => b.id === itemId ? { ...b, status: 'done' } : b));
    } catch {
      setBatch(prev => prev.map(b => b.id === itemId ? { ...b, status: 'error', error: 'Falha na análise' } : b));
    }
  }, [batch, analyzeImage]);

  const onFileChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    e.target.value = '';
    if (files.length === 1) {
      analyzeImage(files[0]);
    } else {
      analyzeBatch(files);
    }
  }, [analyzeImage, analyzeBatch]);

  return {
    images, isUploading, isDistributing, isImproving, error,
    batch, cancelBatch, clearBatch, retryBatchItem,
    fileInputRef, analyzeImage, improveWithAI, distributeImage, removeImage, onFileChange,
  };
}
