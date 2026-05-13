import { ComponentType } from 'react';
import { BrainCircuit, LayoutDashboard, LineChart, Settings, LogOut, User } from 'lucide-react';
import { User as FirebaseUser } from 'firebase/auth';
import { View } from '../types';

interface Props {
  activeView: View;
  onNavigate: (view: View) => void;
  user: FirebaseUser | null;
  onLogout: () => void;
}

const NAV_ITEMS: { view: View; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { view: 'dashboard', label: 'Painel',        Icon: LayoutDashboard },
  { view: 'trends',    label: 'Tendências',    Icon: LineChart },
  { view: 'settings',  label: 'Configurações', Icon: Settings },
];

export function AppSidebar({ activeView, onNavigate, user, onLogout }: Props) {
  return (
    <>
      {/* ── Desktop sidebar ──────────────────────────────────────────────── */}
      <aside className="hidden md:flex w-64 bg-[#0F172A] text-white flex-col shrink-0">
        <div className="p-6 border-b border-slate-700/50">
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BrainCircuit className="w-6 h-6 text-emerald-400" />
            StockLens AI
          </h1>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {NAV_ITEMS.map(({ view, label, Icon }) => (
            <button
              key={view}
              onClick={() => onNavigate(view)}
              className={`w-full p-3 rounded-lg flex items-center gap-3 transition-colors ${
                activeView === view
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm font-medium">{label}</span>
            </button>
          ))}
        </nav>

        <div className="p-6 mt-auto border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center overflow-hidden">
                {user?.photoURL
                  ? <img src={user.photoURL} alt={user.displayName || ''} className="w-full h-full object-cover" />
                  : <User className="w-4 h-4" />}
              </div>
              <div className="text-xs">
                <p className="font-bold truncate max-w-[100px]">{user?.displayName || 'Usuário'}</p>
                <p className="text-slate-400">Plano Pro</p>
              </div>
            </div>
            <button onClick={onLogout} className="p-2 text-slate-400 hover:text-white transition-colors" title="Sair">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom nav ─────────────────────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0F172A] border-t border-slate-700/50 flex items-center justify-around px-2 pb-safe">
        {NAV_ITEMS.map(({ view, label, Icon }) => (
          <button
            key={view}
            onClick={() => onNavigate(view)}
            className={`flex flex-col items-center gap-1 py-3 px-4 rounded-xl transition-colors ${
              activeView === view ? 'text-emerald-400' : 'text-slate-500'
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
          </button>
        ))}
      </nav>
    </>
  );
}
