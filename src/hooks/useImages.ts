import { useState, useEffect, useRef, ChangeEvent, useCallback } from 'react';
import { User as FirebaseUser } from 'firebase/auth';
import { collection, query, where, onSnapshot, deleteDoc, doc, orderBy, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { db, storage } from '../firebase';
import { AnalysisResult, UserSettings, OperationType, View } from '../types';
import { handleFirestoreError } from '../lib/firestore';
import { ai, GEMINI_MODEL, ANALYSIS_PROMPT, analysisResponseSchema } from '../lib/gemini';
import { buildCompliance } from '../lib/compliance';
import { ToastType } from '../components/Toast';
import { prepareImageBlobs, extractImageMetadata, generateThumbnail, applyImageAdjustments } from '../lib/imageProcessing';
import { useBatch } from './useBatch';

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
      const { previewUrl, analysisBlob, isSpecialFormat, warning } = await prepareImageBlobs(file);
      if (warning) setError(warning);

      const [imageMetadata, thumbnailBlob] = await Promise.all([
        extractImageMetadata(file, previewUrl),
        generateThumbnail(analysisBlob, previewUrl),
      ]);

      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.readAsDataURL(analysisBlob);
      });

      const newId = crypto.randomUUID();
      blobCacheRef.current.set(newId, thumbnailBlob);

      const thumbName = file.name.replace(/\.[^/.]+$/, '') + '_thumb.jpg';
      const storageRef = ref(storage, `users/${user.uid}/analyses/${newId}/${thumbName}`);
      const snapshot = await uploadBytes(storageRef, thumbnailBlob, { contentType: 'image/jpeg' });
      const persistentPreviewUrl = await getDownloadURL(snapshot.ref);

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
      } catch {
        setError('Erro ao processar análise da IA. A resposta parece estar incompleta.');
        return;
      }

      const resultData: AnalysisResult = {
        id: newId,
        userId: user.uid,
        name: file.name,
        url: persistentPreviewUrl,
        storagePath: snapshot.ref.fullPath,
        originalUrl: isSpecialFormat ? URL.createObjectURL(file) : null,
        score: data.score,
        keywords: data.keywords,
        trends: data.trends,
        commercialPotential: data.commercialPotential,
        suggestions: data.suggestions,
        editingGuide: data.editingGuide,
        compliance: data.compliance ? buildCompliance(data.compliance, imageMetadata) : undefined,
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

      const blob = await applyImageAdjustments(cachedBlob, guide);
      const exposure = parseFloat(guide.exposure) || 0;
      const contrast = parseFloat(guide.contrast) || 0;

      const newId = crypto.randomUUID();
      const newName = original.name.replace(/\.[^/.]+$/, '') + '_enhanced.jpg';
      const enhancedRef = ref(storage, `users/${user.uid}/analyses/${newId}/${newName}`);
      const snap = await uploadBytes(enhancedRef, blob, { contentType: 'image/jpeg' });
      const downloadUrl = await getDownloadURL(snap.ref);

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
    const missingPlat = platforms.find(p => {
      if (p === 'Shutterstock'               && !settings.shutterstock?.apiKey)  return true;
      if (p === 'Adobe Stock'                && !settings.adobe?.apiKey)          return true;
      if ((p === 'Getty Images' || p === 'iStock') && !settings.getty?.sftpUser) return true;
      return false;
    });

    if (missingPlat) {
      const label = (missingPlat === 'Getty Images' || missingPlat === 'iStock')
        ? 'Getty Images / iStock (SFTP)'
        : missingPlat;
      addToast(`Configure as credenciais do ${label} nas Configurações antes de enviar.`, 'error');
      setActiveView('settings');
      return;
    }

    setIsDistributing(img.id);
    try {
      const response = await fetch('/api/distribute', {
        method: 'POST',
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

      for (const result of data.details ?? []) {
        if (result.status === 'success') {
          const idSuffix = result.submissionId ? ` (ID: ${result.submissionId})` : '';
          addToast(`${result.platform}: ${result.message}${idSuffix}`);
        } else {
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

  const { batch, analyzeBatch, cancelBatch, clearBatch, retryBatchItem } = useBatch(analyzeImage, addToast);

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
