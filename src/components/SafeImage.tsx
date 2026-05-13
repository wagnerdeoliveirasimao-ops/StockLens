import { useState } from 'react';
import { FileImage } from 'lucide-react';

interface Props {
  src: string;
  alt: string;
  className?: string;
}

export const SafeImage = ({ src, alt, className }: Props) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {!isLoaded && !hasError && (
        <div className="absolute inset-0 bg-slate-200 animate-pulse" />
      )}
      {hasError ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 text-slate-400">
          <FileImage className="w-8 h-8 mb-2 opacity-30" />
          <span className="text-[8px] uppercase font-bold tracking-widest text-center px-2">
            Visualização Indisponível
          </span>
        </div>
      ) : (
        <img
          src={src}
          alt={alt}
          className={`w-full h-full object-cover transition-opacity duration-500 ${isLoaded ? 'opacity-100' : 'opacity-0'}`}
          onLoad={() => setIsLoaded(true)}
          onError={() => setHasError(true)}
        />
      )}
    </div>
  );
};
