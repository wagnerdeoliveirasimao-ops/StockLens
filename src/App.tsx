/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { BrainCircuit, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

import { useAuth } from './hooks/useAuth';
import { useImages } from './hooks/useImages';
import { useSettings } from './hooks/useSettings';
import { useToast, ToastContainer } from './components/Toast';
import { AppSidebar } from './components/AppSidebar';
import { ImageDetailPanel } from './components/ImageDetailPanel';
import { DashboardView } from './components/views/DashboardView';
import { HistoryView } from './components/views/HistoryView';
import { TrendsView } from './components/views/TrendsView';
import { SettingsView } from './components/views/SettingsView';
import type { AnalysisResult, View } from './types';

export default function App() {
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [selectedImage, setSelectedImage] = useState<AnalysisResult | null>(null);

  const { toasts, addToast, removeToast } = useToast();
  const { user, authLoading, authError, login, logout } = useAuth();
  const { settings, isSavingSettings, saveSettings } = useSettings(user, addToast);
  const {
    images, isUploading, isDistributing, isImproving, error,
    batch, cancelBatch, clearBatch, retryBatchItem,
    fileInputRef, onFileChange, removeImage, improveWithAI, distributeImage,
  } = useImages(user, addToast, settings, setActiveView);

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-slate-900 font-sans overflow-hidden">
      <AppSidebar activeView={activeView} onNavigate={setActiveView} user={user} onLogout={logout} />

      <main className="flex-1 flex flex-col overflow-hidden relative pb-16 md:pb-0">
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
              {authError && (
                <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-red-700 leading-relaxed">{authError}</p>
                </div>
              )}
              <p className="mt-6 text-[10px] text-slate-400 uppercase font-black tracking-widest">Acesse seu histórico de qualquer lugar</p>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {activeView === 'dashboard' && (
              <DashboardView
                images={images}
                isUploading={isUploading}
                error={error}
                fileInputRef={fileInputRef}
                onFileChange={onFileChange}
                onSelectImage={setSelectedImage}
                onRemoveImage={removeImage}
                batch={batch}
                onCancelBatch={cancelBatch}
                onRetryBatchItem={retryBatchItem}
                onClearBatch={clearBatch}
              />
            )}
            {activeView === 'history' && (
              <HistoryView images={images} onSelectImage={setSelectedImage} />
            )}
            {activeView === 'trends' && <TrendsView />}
            {activeView === 'settings' && (
              <SettingsView settings={settings} isSavingSettings={isSavingSettings} onSave={saveSettings} />
            )}
          </AnimatePresence>
        )}

        <footer className="hidden md:flex px-8 py-4 bg-white border-t border-slate-200 justify-between items-center shrink-0">
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

      <ImageDetailPanel
        image={selectedImage}
        onClose={() => setSelectedImage(null)}
        isImproving={isImproving}
        isDistributing={isDistributing}
        onImprove={improveWithAI}
        onDistribute={distributeImage}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
