import { Fragment } from 'react';
import { CheckCircle2, XCircle, AlertTriangle, ShieldCheck } from 'lucide-react';
import { ImageCompliance, PlatformCompliance, ComplianceCheck } from '../types';

interface Props {
  compliance: ImageCompliance;
}

const PLATFORM_LABELS: Record<keyof ImageCompliance, { name: string; color: string; bg: string; border: string }> = {
  shutterstock: { name: 'Shutterstock', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  getty:        { name: 'Getty Images', color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  adobe:        { name: 'Adobe Stock',  color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200'    },
  istock:       { name: 'iStock',       color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200' },
};

function StatusIcon({ status }: { status: ComplianceCheck['status'] }) {
  if (status === 'pass')    return <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />;
  if (status === 'warning') return <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />;
  return                           <XCircle        className="w-4 h-4 text-red-500 shrink-0" />;
}

function PlatformCard({ platform, data }: { platform: keyof ImageCompliance; data: PlatformCompliance }) {
  const meta = PLATFORM_LABELS[platform];
  const fails    = data.checks.filter(c => c.status === 'fail').length;
  const warnings = data.checks.filter(c => c.status === 'warning').length;

  return (
    <div className={`rounded-2xl border p-4 ${meta.bg} ${meta.border}`}>
      {/* Platform header */}
      <div className="flex items-center justify-between mb-3">
        <span className={`font-black text-xs uppercase tracking-wider ${meta.color}`}>{meta.name}</span>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Score</span>
            <span className={`text-sm font-black ${data.score >= 70 ? 'text-emerald-600' : data.score >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
              {data.score}%
            </span>
          </div>
          <div className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider ${
            data.eligible ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'
          }`}>
            {data.eligible ? 'ELEGÍVEL' : 'REPROVADA'}
          </div>
        </div>
      </div>

      {/* Summary chips */}
      {(fails > 0 || warnings > 0) && (
        <div className="flex gap-2 mb-3 flex-wrap">
          {fails > 0 && (
            <span className="flex items-center gap-1 bg-red-100 text-red-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
              <XCircle className="w-3 h-3" /> {fails} reprovação{fails > 1 ? 'ões' : ''}
            </span>
          )}
          {warnings > 0 && (
            <span className="flex items-center gap-1 bg-amber-100 text-amber-700 px-2 py-0.5 rounded-md text-[10px] font-bold">
              <AlertTriangle className="w-3 h-3" /> {warnings} aviso{warnings > 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* Checks list */}
      <div className="space-y-2">
        {data.checks.map((check, idx) => (
          <div key={idx} className="flex items-start gap-2 bg-white/70 rounded-xl px-3 py-2">
            <StatusIcon status={check.status} />
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-wider leading-none mb-0.5">
                {check.label}
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">{check.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CompliancePanel({ compliance }: Props) {
  const platforms: (keyof ImageCompliance)[] = ['shutterstock', 'getty', 'adobe', 'istock'];
  const eligible  = platforms.filter(p => compliance[p]?.eligible).length;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 text-slate-800">
        <ShieldCheck className="w-5 h-5" />
        <h4 className="font-black text-sm uppercase tracking-wider">Conformidade com Plataformas</h4>
        <span className="ml-auto text-[10px] font-black text-slate-400 uppercase tracking-widest">
          {eligible}/{platforms.length} elegíveis
        </span>
      </div>

      <div className="space-y-3">
        {platforms.map(platform => compliance[platform] ? (
          <Fragment key={platform}>
            <PlatformCard platform={platform} data={compliance[platform]} />
          </Fragment>
        ) : null)}
      </div>
    </section>
  );
}
