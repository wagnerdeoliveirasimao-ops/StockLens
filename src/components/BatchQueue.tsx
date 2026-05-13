import { CheckCircle2, AlertCircle, Loader2, Clock, X, RefreshCw, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { BatchItem } from '../types';

interface Props {
  batch: BatchItem[];
  onCancel: () => void;
  onRetry: (id: string) => void;
  onClear: () => void;
}

const STATUS_ICON = {
  queued:    <Clock className="w-4 h-4 text-slate-400" />,
  analyzing: <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />,
  done:      <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  error:     <AlertCircle className="w-4 h-4 text-red-400" />,
};

const STATUS_LABEL = {
  queued:    'Na fila',
  analyzing: 'Analisando...',
  done:      'Concluída',
  error:     'Erro',
};

export function BatchQueue({ batch, onCancel, onRetry, onClear }: Props) {
  if (batch.length === 0) return null;

  const done = batch.filter(b => b.status === 'done').length;
  const errors = batch.filter(b => b.status === 'error').length;
  const isRunning = batch.some(b => b.status === 'analyzing' || b.status === 'queued');
  const progress = Math.round((done / batch.length) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-bold text-slate-800">
              Lote de {batch.length} foto{batch.length > 1 ? 's' : ''}
            </p>
            <p className="text-xs text-slate-400">
              {done} concluída{done !== 1 ? 's' : ''}
              {errors > 0 && ` · ${errors} com erro`}
              {isRunning && ` · processando...`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button
              onClick={onCancel}
              className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancelar
            </button>
          )}
          {!isRunning && (
            <button
              onClick={onClear}
              className="text-xs text-slate-400 hover:text-slate-600 font-bold flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-100">
        <motion.div
          className="h-full bg-emerald-500"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ ease: 'easeOut' }}
        />
      </div>

      {/* File list */}
      <div className="divide-y divide-slate-50 max-h-64 overflow-y-auto">
        <AnimatePresence initial={false}>
          {batch.map((item) => (
            <motion.div
              key={item.id}
              layout
              className="px-5 py-3 flex items-center gap-3"
            >
              <div className="shrink-0">{STATUS_ICON[item.status]}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-slate-700 truncate">{item.name}</p>
                {item.error && (
                  <p className="text-[10px] text-red-400">{item.error}</p>
                )}
              </div>
              <span className={`text-[10px] font-bold shrink-0 ${
                item.status === 'done'      ? 'text-emerald-600' :
                item.status === 'error'     ? 'text-red-400'     :
                item.status === 'analyzing' ? 'text-emerald-500' :
                'text-slate-400'
              }`}>
                {STATUS_LABEL[item.status]}
              </span>
              {item.status === 'error' && item.error !== 'Cancelado' && (
                <button
                  onClick={() => onRetry(item.id)}
                  className="shrink-0 p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                  title="Tentar novamente"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
