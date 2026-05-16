import { useState, useRef, useCallback } from 'react';
import { BatchItem } from '../types';
import { ToastType } from '../components/Toast';

export function useBatch(
  analyzeImage: (file: File) => Promise<void>,
  addToast: (message: string, type?: ToastType) => void
) {
  const [batch, setBatch] = useState<BatchItem[]>([]);
  const cancelBatchRef = useRef(false);

  const analyzeBatch = useCallback(async (files: File[]) => {
    if (files.length === 0) return;
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

      // Small pause between requests to avoid rate limiting
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
  }, [analyzeImage, addToast]);

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

  return { batch, analyzeBatch, cancelBatch, clearBatch, retryBatchItem };
}
