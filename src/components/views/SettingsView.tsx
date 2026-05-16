import { FormEvent } from 'react';
import { AlertCircle, Loader2, ExternalLink } from 'lucide-react';
import { motion } from 'motion/react';
import { UserSettings } from '../../types';

interface Props {
  settings: UserSettings;
  isSavingSettings: boolean;
  onSave: (settings: UserSettings) => void;
}

export function SettingsView({ settings, isSavingSettings, onSave }: Props) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    onSave({
      ...settings,
      shutterstock: { apiKey: f.get('ss_key') as string, apiSecret: f.get('ss_secret') as string, contributorId: f.get('ss_cid') as string },
      getty: { sftpUser: f.get('gt_user') as string, sftpPassword: f.get('gt_pass') as string },
      adobe: { apiKey: f.get('ad_key') as string, apiSecret: f.get('ad_secret') as string },
    });
  };

  return (
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
            <div className="bg-white p-6 rounded-2xl border border-slate-200">
              <label className="block text-xs font-bold text-slate-600 mb-1">Chave da API</label>
              <div className="flex gap-2">
                <input type="password" value="************************" readOnly className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono" />
                <button className="text-xs bg-slate-900 text-white px-4 rounded-lg font-bold">Gerenciar</button>
              </div>
              <p className="mt-2 text-[10px] text-slate-400 italic">As chaves de IA são gerenciadas pelo arquivo .env.local.</p>
            </div>
          </section>

          <form onSubmit={handleSubmit}>
            <section>
              <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center justify-between">
                Plataformas de Distribuição
                {isSavingSettings && <Loader2 className="w-4 h-4 animate-spin" />}
              </h3>
              <div className="space-y-4">
                {/* Shutterstock */}
                <PlatformCard
                  letter="S" name="Shutterstock" subtitle="API Contributor (OAuth2)"
                  docsUrl="https://www.shutterstock.com/account/developers/apps"
                  docsLabel="Criar app em shutterstock.com/developers"
                  isActive={!!settings.shutterstock?.apiKey}
                  fields={[
                    { name: 'ss_key',    label: 'Consumer Key',    type: 'text',     defaultValue: settings.shutterstock?.apiKey || '',       placeholder: 'Consumer Key do app' },
                    { name: 'ss_secret', label: 'Consumer Secret', type: 'password', defaultValue: settings.shutterstock?.apiSecret || '',     placeholder: 'Consumer Secret do app' },
                    { name: 'ss_cid',    label: 'Contributor ID',  type: 'text',     defaultValue: settings.shutterstock?.contributorId || '', placeholder: 'ID numérico da sua conta', fullWidth: true },
                  ]}
                  accentClass="bg-slate-100 text-slate-400"
                />
                {/* Getty + iStock */}
                <PlatformCard
                  letter="G" name="Getty Images + iStock" subtitle="Upload via SFTP (sftp.gettyimages.com)"
                  docsUrl="https://contributor.gettyimages.com"
                  docsLabel="Getty Contributor Hub — obter credenciais SFTP"
                  isActive={!!settings.getty?.sftpUser}
                  fields={[
                    { name: 'gt_user', label: 'Usuário SFTP',   type: 'text',     defaultValue: settings.getty?.sftpUser || '',     placeholder: 'Seu usuário Getty Contributor' },
                    { name: 'gt_pass', label: 'Senha SFTP',     type: 'password', defaultValue: settings.getty?.sftpPassword || '', placeholder: 'Senha do Getty Contributor Hub' },
                  ]}
                  accentClass="bg-emerald-50 text-emerald-600"
                  note="As mesmas credenciais dão acesso a Getty Images e iStock. Obtenha-as no Getty Contributor Hub."
                />
                {/* Adobe */}
                <PlatformCard
                  letter="A" name="Adobe Stock" subtitle="API Contributor (Adobe IMS)"
                  docsUrl="https://developer.adobe.com/developer-console/"
                  docsLabel="Criar projeto em Adobe Developer Console"
                  isActive={!!settings.adobe?.apiKey}
                  fields={[
                    { name: 'ad_key',    label: 'Client ID (API Key)', type: 'text',     defaultValue: settings.adobe?.apiKey || '',    placeholder: 'Client ID do projeto Adobe' },
                    { name: 'ad_secret', label: 'Client Secret',       type: 'password', defaultValue: settings.adobe?.apiSecret || '', placeholder: 'Client Secret do projeto Adobe' },
                  ]}
                  accentClass="bg-blue-50 text-blue-600"
                  activeClass="bg-blue-50 text-blue-600"
                />

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
                Suas chaves são salvas protegidas pelas regras de segurança do Firebase.
                Nunca compartilhe seu Consumer Secret com ninguém.
              </p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface Field { name: string; label: string; type: string; defaultValue: string; placeholder: string; fullWidth?: boolean }
interface PlatformCardProps {
  letter: string; name: string; subtitle: string;
  isActive: boolean; fields: Field[];
  accentClass: string; activeClass?: string;
  docsUrl?: string; docsLabel?: string;
  disabled?: boolean; note?: string;
}

function PlatformCard({ letter, name, subtitle, isActive, fields, accentClass, activeClass, docsUrl, docsLabel, disabled, note }: PlatformCardProps) {
  const activeStyle = activeClass ?? 'bg-emerald-50 text-emerald-600';
  return (
    <div className={`bg-white p-6 rounded-2xl border border-slate-200 flex flex-col gap-4 ${disabled ? 'opacity-60' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black ${accentClass}`}>{letter}</div>
          <div>
            <h4 className="font-bold">{name}</h4>
            <p className="text-xs text-slate-400">{subtitle}</p>
            {docsUrl && (
              <a href={docsUrl} target="_blank" rel="noopener noreferrer"
                 className="text-[10px] text-emerald-600 hover:underline flex items-center gap-1 mt-0.5">
                <ExternalLink className="w-3 h-3" />{docsLabel ?? docsUrl}
              </a>
            )}
          </div>
        </div>
        <span className={`text-[10px] font-black px-2 py-1 rounded ${isActive ? activeStyle : 'bg-slate-50 text-slate-400'}`}>
          {disabled ? 'N/A' : isActive ? 'ATIVO' : 'DESCONECTADO'}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-50">
        {fields.map(f => (
          <div key={f.name} className={f.fullWidth ? 'md:col-span-2' : ''}>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{f.label}</label>
            <input
              name={f.name} type={f.type} defaultValue={f.defaultValue} placeholder={f.placeholder}
              disabled={disabled}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono disabled:cursor-not-allowed"
            />
          </div>
        ))}
      </div>
      {note && (
        <p className="text-[10px] text-slate-400 italic leading-relaxed pt-1 border-t border-slate-50">{note}</p>
      )}
    </div>
  );
}
