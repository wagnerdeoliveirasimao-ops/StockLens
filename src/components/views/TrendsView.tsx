import { useState, useRef } from 'react';
import { TrendingUp, FileImage } from 'lucide-react';
import { motion } from 'motion/react';

const TrendImage = ({ img, title, idx, query }: { img: string; title: string; idx: number; query: string; key?: number }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const triedFallback = useRef(false);

  return (
    <div className={`h-full relative overflow-hidden ${isFailed ? 'bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center' : 'bg-slate-200'}`}>
      {!isLoaded && !isFailed && <div className="absolute inset-0 bg-slate-300 animate-pulse" />}
      {!isFailed ? (
        <img
          src={img}
          alt={`${title} example ${idx + 1}`}
          className={`relative w-full h-full object-cover transition-all duration-700 group-hover:scale-110 z-10 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          loading="lazy"
          onLoad={() => setIsLoaded(true)}
          onError={(e) => {
            if (triedFallback.current) { setIsFailed(true); return; }
            triedFallback.current = true;
            (e.target as HTMLImageElement).src = `https://picsum.photos/seed/${query}${idx}/600/400`;
          }}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-2 text-center opacity-40">
          <FileImage className="w-6 h-6 mb-1 text-slate-400" />
          <span className="text-[8px] uppercase tracking-tighter text-slate-400 font-bold">Trend View</span>
        </div>
      )}
    </div>
  );
};

const TRENDS = [
  {
    title: 'Autenticidade Radical', term: 'Candid & Unretouched',
    description: "A saída do 'perfeito' para o 'real'. Fotos que capturam imperfeições, momentos espontâneos e diversidade genuína sem edições pesadas de pele.",
    keywords: ['Real people', 'No filter', 'Body positivity', 'Multi-generational'],
    images: ['https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?q=80&w=600&auto=format&fit=crop'],
    color: 'text-emerald-500', bg: 'bg-emerald-50', query: 'people',
  },
  {
    title: 'Vida Sustentável e ESG', term: 'Eco-Conscious Living',
    description: 'A sustentabilidade não é mais apenas verde. É sobre economia circular, energia limpa integrada ao cotidiano e consumo consciente.',
    keywords: ['Solar energy', 'Zero-waste', 'Climate action', 'Sustainable tech'],
    images: ['https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1542601906990-b4d3fb778eff?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1466611653911-954ff21b6748?q=80&w=600&auto=format&fit=crop'],
    color: 'text-blue-500', bg: 'bg-blue-50', query: 'nature',
  },
  {
    title: 'O Profissional Híbrido', term: 'Hybrid & Creator Economy',
    description: "O novo escritório é qualquer lugar. Foco em setups ergonômicos em casa, co-workings dinâmicos e ferramentas de criação de conteúdo.",
    keywords: ['Remote work', 'Digital nomad', 'Vlogging setup', 'Ergonomic office'],
    images: ['https://images.unsplash.com/photo-1499750310107-5fef28a66643?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1556761175-b413da4baf72?q=80&w=600&auto=format&fit=crop'],
    color: 'text-amber-500', bg: 'bg-amber-50', query: 'office',
  },
  {
    title: 'Luxo Silencioso', term: 'Quiet Luxury',
    description: 'Minimalismo elevado. Paletas de cores neutras, texturas ricas e composição focada em qualidade e durabilidade em vez de logos ou ostentação.',
    keywords: ['Organic minimalism', 'Earth tones', 'High-end textures', 'Soft lighting'],
    images: ['https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1616489953149-86644eb98752?q=80&w=600&auto=format&fit=crop'],
    color: 'text-purple-500', bg: 'bg-purple-50', query: 'interior',
  },
  {
    title: 'Bem-estar Digital', term: 'Digital Wellness',
    description: 'Imagens que mostram o equilíbrio com a tecnologia. Momentos de desconexão, mindfulness e o uso saudável de dispositivos.',
    keywords: ['Digital detox', 'Mindfulness', 'Mental health', 'Tech balance'],
    images: ['https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1518314916301-73c9d955c4da?q=80&w=600&auto=format&fit=crop'],
    color: 'text-rose-500', bg: 'bg-rose-50', query: 'yoga',
  },
  {
    title: 'Ultra-Localismo', term: 'Hyper-Local Culture',
    description: 'Valorização das raízes locais e herança cultural. Fotos que celebram comunidades específicas, artesãos e tradições regionais.',
    keywords: ['Local heritage', 'Artisanship', 'Community roots', 'Slow travel'],
    images: ['https://images.unsplash.com/photo-1558444479-c86e46272c50?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1581333100576-b73bbe92c2cb?q=80&w=600&auto=format&fit=crop', 'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?q=80&w=600&auto=format&fit=crop'],
    color: 'text-cyan-500', bg: 'bg-cyan-50', query: 'craft',
  },
];

export function TrendsView() {
  return (
    <motion.div
      key="trends"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex-1 flex flex-col overflow-hidden"
    >
      <header className="h-20 bg-white border-b border-slate-200 px-8 flex items-center shrink-0">
        <h2 className="text-xl font-semibold">Tendências do Mercado de Stock 2026</h2>
      </header>
      <div className="p-8 flex-1 overflow-y-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {TRENDS.map((trend, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm flex flex-col hover:shadow-lg transition-shadow"
            >
              <div className="h-48 overflow-hidden relative group grid grid-cols-3 gap-0.5 bg-slate-200">
                {trend.images.map((img, idx) => (
                  <TrendImage key={idx} img={img} title={trend.title} idx={idx} query={trend.query} />
                ))}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex items-end p-6 pointer-events-none">
                  <span className="text-[10px] font-black text-white uppercase tracking-widest px-3 py-1 bg-white/20 backdrop-blur-md rounded-full border border-white/30">
                    Exemplos de Composição
                  </span>
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-2xl ${trend.bg} ${trend.color}`}>
                    <TrendingUp className="w-6 h-6" />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{trend.term}</span>
                </div>
                <h3 className="font-black text-xl mb-3 text-slate-800 uppercase tracking-tight">{trend.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">{trend.description}</p>
                <div>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Social Meta-tags</p>
                  <div className="flex flex-wrap gap-2">
                    {trend.keywords.map(kw => (
                      <span key={kw} className="text-[10px] bg-slate-50 text-slate-600 px-2 py-1 rounded-md border border-slate-100 font-bold">
                        #{kw}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
