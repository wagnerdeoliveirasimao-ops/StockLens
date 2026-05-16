import exifr from 'exifr';
import heic2any from 'heic2any';
import { ImageMetadata } from '../types';

const RAW_EXTENSIONS = ['cr2', 'cr3', 'nef', 'arw', 'dng', 'raf', 'orf', 'sr2', 'pef', 'x3f'];

function isHeicFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ['heic', 'heif'].includes(ext) || file.type.includes('heic') || file.type.includes('heif');
}

function isRawFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  return RAW_EXTENSIONS.includes(ext);
}

export interface PreparedImage {
  previewUrl: string;
  analysisBlob: Blob;
  isSpecialFormat: boolean;
  warning?: string;
}

export async function prepareImageBlobs(file: File): Promise<PreparedImage> {
  let previewUrl = URL.createObjectURL(file);
  let analysisBlob: Blob = file;
  let warning: string | undefined;
  const isSpecialFormat = isHeicFile(file) || isRawFile(file);

  if (isHeicFile(file)) {
    try {
      try {
        const thumbnail = await exifr.thumbnail(file);
        if (!thumbnail) throw new Error('No thumbnail');
        const tb = new Blob([thumbnail], { type: 'image/jpeg' });
        previewUrl = URL.createObjectURL(tb);
        analysisBlob = tb;
      } catch {
        let result;
        try {
          result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.5 });
        } catch {
          result = await heic2any({ blob: file, toType: 'image/png' });
        }
        const blob = Array.isArray(result) ? result[0] : result;
        previewUrl = URL.createObjectURL(blob);
        analysisBlob = blob;
      }
    } catch (err) {
      console.error('Critical error handling HEIC file:', err);
      warning = 'Não foi possível gerar uma pré-visualização para este HEIC, mas a IA processará o arquivo original.';
    }
  } else if (isRawFile(file)) {
    try {
      const thumbnail = await exifr.thumbnail(file);
      if (thumbnail) {
        const tb = new Blob([thumbnail], { type: 'image/jpeg' });
        previewUrl = URL.createObjectURL(tb);
        analysisBlob = tb;
      }
    } catch { /* continue with original */ }
  }

  return { previewUrl, analysisBlob, isSpecialFormat, warning };
}

export async function extractImageMetadata(file: File, previewUrl: string): Promise<ImageMetadata | undefined> {
  try {
    const exif = await exifr.parse(file, [
      'ImageWidth', 'ImageHeight', 'ExifImageWidth', 'ExifImageHeight', 'PixelXDimension', 'PixelYDimension',
    ]);
    const w = exif?.ImageWidth ?? exif?.ExifImageWidth ?? exif?.PixelXDimension;
    const h = exif?.ImageHeight ?? exif?.ExifImageHeight ?? exif?.PixelYDimension;
    if (w && h) return { width: w, height: h, megapixels: (w * h) / 1_000_000 };
  } catch { /* fallback below */ }

  try {
    const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth || img.width, h: img.naturalHeight || img.height });
      img.onerror = reject;
      img.src = previewUrl;
    });
    if (dims.w && dims.h) return { width: dims.w, height: dims.h, megapixels: (dims.w * dims.h) / 1_000_000 };
  } catch { /* no metadata available */ }

  return undefined;
}

export async function generateThumbnail(analysisBlob: Blob, previewUrl: string): Promise<Blob> {
  return new Promise<Blob>((resolve) => {
    const img = new Image();
    const timeout = setTimeout(() => resolve(analysisBlob), 5000);
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        let { width, height } = img;
        if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d')?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(b => resolve(b ?? analysisBlob), 'image/jpeg', 0.7);
      } catch { resolve(analysisBlob); }
    };
    img.onerror = () => { clearTimeout(timeout); resolve(analysisBlob); };
    img.src = previewUrl;
  });
}

export async function applyImageAdjustments(
  blob: Blob,
  guide: { exposure: string; contrast: string; saturation: string }
): Promise<Blob> {
  const localUrl = URL.createObjectURL(blob);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = localUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imageData.data;
    const exposure = parseFloat(guide.exposure) || 0;
    const contrast = parseFloat(guide.contrast) || 0;
    const saturation = parseFloat(guide.saturation) || 0;
    const exposureFactor = Math.pow(2, exposure);
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < d.length; i += 4) {
      let r = d[i], g = d[i + 1], b = d[i + 2];
      r = Math.min(255, r * exposureFactor);
      g = Math.min(255, g * exposureFactor);
      b = Math.min(255, b * exposureFactor);
      r = Math.min(255, Math.max(0, contrastFactor * (r - 128) + 128));
      g = Math.min(255, Math.max(0, contrastFactor * (g - 128) + 128));
      b = Math.min(255, Math.max(0, contrastFactor * (b - 128) + 128));
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const sat = saturation / 100;
      r = Math.min(255, Math.max(0, lum + (r - lum) * (1 + sat)));
      g = Math.min(255, Math.max(0, lum + (g - lum) * (1 + sat)));
      b = Math.min(255, Math.max(0, lum + (b - lum) * (1 + sat)));
      d[i] = r; d[i + 1] = g; d[i + 2] = b;
    }
    ctx.putImageData(imageData, 0, 0);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas vazio')), 'image/jpeg', 0.92);
    });
  } finally {
    URL.revokeObjectURL(localUrl);
  }
}
