import { Download, X, TrendingUp, BrainCircuit, Upload, Send, Search, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AnalysisResult } from '../types';
import { SafeImage } from './SafeImage';
import { CompliancePanel } from './CompliancePanel';

interface Props {
  image: AnalysisResult | null;
  onClose: () => void;
  isImproving: string | null;
  isDistributing: string | null;
  onImprove: (img: AnalysisResult) => void;
  onDistribute: (img: AnalysisResult, platforms: string[]) => void;
}

export function ImageDetailPanel({ image, onClose, isImproving, isDistributing, onImprove, onDistribute }: Props) {
  return (
    <AnimatePresence>
      {image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-end p-0 md:p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="bg-white w-full max-w-2xl h-full md:h-[95vh] md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-5 pt-4 pb-4 border-b border-slate-100 shrink-0 bg-white sticky top-0 z-10">
              {/* Badge + close button */}
              <div className="flex items-center justify-between mb-2">
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${image.name.includes('_enhanced') ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {image.name.includes('_enhanced') ? 'VERSÃO APRIMORADA' : 'VERSÃO ORIGINAL'}
                </span>
                <button onClick={onClose} className="p-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Title — full width, no clamp */}
              <p className="text-sm font-semibold text-slate-800 leading-snug mb-1">{image.commercialPotential}</p>
              <p className="text-[11px] text-slate-400 font-mono truncate">{image.name}</p>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 md:space-y-8 pb-8">
              {/* Hero */}
              <div className="aspect-video bg-slate-100 rounded-2xl overflow-hidden border border-slate-200 relative">
                <SafeImage src={image.url} alt={image.name} className="w-full h-full" />
                <div className="absolute top-4 right-4">
                  <button
                    onClick={() => {
                      const link = document.createElement('a');
                      link.href = image.originalUrl || image.url;
                      link.download = image.name;
                      link.click();
                    }}
                    className="p-2 bg-white/90 backdrop-blur shadow-sm hover:bg-white rounded-lg text-slate-800 transition-all flex items-center gap-2 text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    BAIXAR
                  </button>
                </div>
                <div className="absolute bottom-4 left-4 bg-emerald-600 text-white px-4 py-2 rounded-xl shadow-lg border border-emerald-500/50">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-0.5 opacity-80">Score de Potencial</p>
                  <p className="text-2xl font-black">{image.score}%</p>
                </div>
              </div>

              {/* Market Analysis */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-emerald-600">
                  <TrendingUp className="w-5 h-5" />
                  <h4 className="font-black text-sm uppercase tracking-wider">Análise de Mercado</h4>
                </div>
                <div className="bg-emerald-50/50 p-5 rounded-2xl border border-emerald-100/50">
                  <p className="text-sm text-slate-700 leading-relaxed font-medium mb-4">{image.trends}</p>
                  <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-2">Palavras-chave Sugeridas</p>
                  <div className="flex flex-wrap gap-2">
                    {image.keywords.map(k => (
                      <span key={k} className="bg-white border border-slate-200 px-3 py-1 rounded-lg text-xs text-slate-600 font-medium">#{k}</span>
                    ))}
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {[
                      { label: 'Exposição',  value: image.editingGuide?.exposure },
                      { label: 'Contraste',  value: image.editingGuide?.contrast },
                      { label: 'Saturação',  value: image.editingGuide?.saturation },
                      { label: 'Highlights', value: image.editingGuide?.highlights },
                      { label: 'Sombras',    value: image.editingGuide?.shadows },
                      { label: 'Temp. Cor',  value: image.editingGuide?.colorTemp },
                    ].map(item => (
                      <div key={item.label} className="bg-white p-3 rounded-xl border border-slate-100 text-center">
                        <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">{item.label}</p>
                        <p className="text-sm font-black text-slate-700">{item.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="bg-white/50 p-3 rounded-xl border border-dashed border-slate-200">
                    <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Sugestão de Enquadramento</p>
                    <p className="text-xs text-slate-600 italic leading-relaxed">{image.editingGuide?.cropSuggestion}</p>
                  </div>
                </div>
              </section>

              {/* Compliance */}
              {image.compliance && (
                <CompliancePanel compliance={image.compliance} />
              )}

              {/* Actions */}
              <section className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="font-black text-xs text-slate-400 uppercase tracking-widest text-center">Próximos Passos</h4>
                <div className="grid grid-cols-1 gap-3">
                  {!image.name.includes('_enhanced') && (
                    <button
                      disabled={isImproving === image.id}
                      onClick={() => onImprove(image)}
                      className="w-full bg-emerald-600 text-white p-4 rounded-2xl font-black text-sm hover:bg-emerald-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-200 disabled:opacity-50"
                    >
                      {isImproving === image.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <BrainCircuit className="w-5 h-5" />}
                      GERAR VERSÃO APRIMORADA VIA IA
                    </button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'SHUTTERSTOCK', platform: 'Shutterstock', Icon: Upload, style: 'bg-slate-900 text-white hover:bg-black' },
                      { label: 'ADOBE STOCK',  platform: 'Adobe Stock',  Icon: Search, style: 'bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50' },
                      { label: 'GETTY IMAGES', platform: 'Getty Images', Icon: Send,   style: 'bg-white border-2 border-slate-700 text-slate-700 hover:bg-slate-50' },
                      { label: 'ISTOCK',       platform: 'iStock',       Icon: Send,   style: 'bg-white border-2 border-violet-600 text-violet-600 hover:bg-violet-50' },
                    ].map(({ label, platform, Icon, style }) => (
                      <button
                        key={platform}
                        disabled={isDistributing === image.id}
                        onClick={() => onDistribute(image, [platform])}
                        className={`p-4 rounded-2xl font-black text-[10px] transition-all flex flex-col items-center justify-center gap-2 disabled:opacity-50 ${style}`}
                      >
                        {isDistributing === image.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
