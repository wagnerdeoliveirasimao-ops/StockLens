import { ChangeEvent, RefObject } from 'react';
import { Upload, FileImage, AlertCircle, Loader2, X, ChevronRight, Image as ImageIcon, CheckCircle2, XCircle } from 'lucide-react';
import { ImageCompliance } from '../../types';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisResult, BatchItem } from '../../types';
import { SafeImage } from '../SafeImage';
import { BatchQueue } from '../BatchQueue';

interface Props {
  images: AnalysisResult[];
  isUploading: boolean;
  error: string | null;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onSelectImage: (img: AnalysisResult) => void;
  onRemoveImage: (id: string, userId: string) => void;
  batch: BatchItem[];
  onCancelBatch: () => void;
  onRetryBatchItem: (id: string) => void;
  onClearBatch: () => void;
}

export function DashboardView({ images, isUploading, error, fileInputRef, onFileChange, onSelectImage, onRemoveImage, batch, onCancelBatch, onRetryBatchItem, onClearBatch }: Props) {
  return (
    <motion.div
      key="dashboard"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <header className="h-16 md:h-20 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-base md:text-xl font-semibold">Análise de Potencial</h2>
          <p className="hidden sm:block text-sm text-slate-500">Baseado em dados de Getty Images e Shutterstock</p>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="bg-emerald-600 text-white px-4 md:px-6 py-2 md:py-2.5 rounded-lg font-semibold text-xs md:text-sm hover:bg-emerald-700 shadow-sm transition-colors flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          <span className="hidden sm:inline">Upload de Novas Fotos</span>
          <span className="sm:hidden">Upload</span>
        </button>
      </header>

      <div className="p-4 md:p-8 flex-1 overflow-y-auto space-y-4 md:space-y-6">
        {/* Drop zone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="group relative border-2 border-dashed border-slate-300 bg-white rounded-xl p-6 md:p-8 text-center flex flex-col items-center justify-center hover:border-emerald-500 transition-all cursor-pointer shadow-sm"
        >
          <input type="file" ref={fileInputRef} onChange={onFileChange} className="hidden" accept="image/*" multiple />
          {isUploading ? (
            <div className="flex flex-col items-center gap-3 py-2">
              <Loader2 className="w-8 h-8 md:w-10 md:h-10 animate-spin text-emerald-500" />
              <p className="text-sm font-medium animate-pulse text-slate-600">A IA está analisando sua foto...</p>
            </div>
          ) : (
            <>
              <div className="bg-slate-50 p-3 md:p-4 rounded-full mb-3 md:mb-4 group-hover:bg-emerald-50 transition-colors">
                <FileImage className="w-7 h-7 md:w-8 md:h-8 text-slate-400 group-hover:text-emerald-500" />
              </div>
              <p className="text-slate-600 mb-1 font-medium text-sm md:text-base">
                <span className="hidden md:inline">Arraste suas fotos aqui ou clique para selecionar</span>
                <span className="md:hidden">Toque para selecionar fotos</span>
              </p>
              <p className="text-xs text-slate-400">PNG, JPG, WEBP · Várias fotos para análise em lote</p>
            </>
          )}
        </div>

        <AnimatePresence>
          {batch.length > 0 && (
            <BatchQueue
              batch={batch}
              onCancel={onCancelBatch}
              onRetry={onRetryBatchItem}
              onClear={onClearBatch}
            />
          )}
        </AnimatePresence>

        {error && (
          <div className="p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-3 text-sm border border-red-100">
            <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
          </div>
        )}

        {images.length > 0 && (
          <div className="bg-slate-100 p-3 md:p-4 rounded-xl flex items-center justify-around border border-slate-200">
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Analisadas</p>
              <p className="text-base md:text-lg font-bold">{images.length}</p>
            </div>
            <div className="h-8 w-px bg-slate-300" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Potencial Médio</p>
              <p className="text-base md:text-lg font-bold text-emerald-600">
                {(images.reduce((acc, img) => acc + img.score, 0) / images.length).toFixed(0)}%
              </p>
            </div>
            <div className="h-8 w-px bg-slate-300" />
            <div className="text-center">
              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Status</p>
              <p className="text-base md:text-lg font-bold">Ativo</p>
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
                onClick={() => onSelectImage(img)}
                className="bg-white rounded-xl border border-slate-200 p-3 flex gap-3 hover:border-emerald-500 cursor-pointer transition-all hover:shadow-md group active:scale-[0.99]"
              >
                {/* Thumbnail */}
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden shrink-0 border border-slate-200 self-start">
                  <SafeImage src={img.url} alt={img.name} className="w-full h-full" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  {/* Top row: badge + score */}
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[9px] font-black px-1.5 py-0.5 rounded shrink-0 ${img.name.includes('_enhanced') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                      {img.name.includes('_enhanced') ? 'APRIMORADA' : 'ORIGINAL'}
                    </span>
                    <span className={`text-base md:text-lg font-black shrink-0 ${img.score > 80 ? 'text-emerald-600' : 'text-slate-600'}`}>
                      {img.score}%
                    </span>
                  </div>

                  {/* Analysis text — no clamp, shows fully */}
                  <p className="text-xs md:text-sm text-slate-800 font-medium leading-snug">{img.commercialPotential}</p>

                  {/* Platform indicators */}
                  <PlatformBadges compliance={img.compliance} />

                  {/* Filename */}
                  <p className="text-[10px] text-slate-400 font-mono truncate">{img.name}</p>
                </div>

                {/* Actions — desktop only */}
                <div className="hidden md:flex flex-col items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity border-l border-slate-100 pl-3 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); onRemoveImage(img.id, img.userId); }}
                    className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-4 h-4 text-slate-300" />
                </div>
                <ChevronRight className="md:hidden w-4 h-4 text-slate-300 shrink-0 self-center" />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {!images.length && !isUploading && (
          <div className="h-[35vh] flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <ImageIcon className="w-8 h-8 text-slate-300" />
            </div>
            <h3 className="font-semibold text-slate-800">Pronto para começar?</h3>
            <p className="text-sm text-slate-500 max-w-xs mt-1">
              <span className="hidden md:inline">Arraste suas fotos para o painel acima para análise imediata.</span>
              <span className="md:hidden">Toque na área acima para enviar suas fotos.</span>
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ── Platform compliance badges ─────────────────────────────────────────────────

const PLATFORMS: { key: keyof ImageCompliance; label: string }[] = [
  { key: 'shutterstock', label: 'SS' },
  { key: 'getty',        label: 'GI' },
  { key: 'adobe',        label: 'AS' },
  { key: 'istock',       label: 'IS' },
];

function PlatformBadges({ compliance }: { compliance?: ImageCompliance }) {
  if (!compliance) return null;

  return (
    <div className="flex items-center gap-1.5">
      {PLATFORMS.map(({ key, label }) => {
        const platform = compliance[key];
        if (!platform) return null;
        return (
          <span
            key={key}
            className={`inline-flex items-center gap-1 text-[10px] font-black px-1.5 py-0.5 rounded-md ${
              platform.eligible
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {platform.eligible
              ? <CheckCircle2 className="w-3 h-3" />
              : <XCircle className="w-3 h-3" />}
            {label}
          </span>
        );
      })}
    </div>
  );
}
