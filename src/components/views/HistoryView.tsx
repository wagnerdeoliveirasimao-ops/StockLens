import { motion } from 'motion/react';
import { AnalysisResult } from '../../types';
import { SafeImage } from '../SafeImage';

interface Props {
  images: AnalysisResult[];
  onSelectImage: (img: AnalysisResult) => void;
}

export function HistoryView({ images, onSelectImage }: Props) {
  return (
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
                <tr key={img.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => onSelectImage(img)}>
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
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400 italic">
                    Nenhum histórico disponível ainda
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}
