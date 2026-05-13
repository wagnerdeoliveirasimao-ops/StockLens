import { ImageCompliance, PlatformCompliance, ComplianceCheck, ImageMetadata } from '../types';
import { PLATFORM_RESOLUTION_REQUIREMENTS } from './gemini';

type PlatformKey = 'shutterstock' | 'getty' | 'adobe';

interface RawPlatformChecks {
  checks: Array<{ checkId: string; status: string; label: string; message: string }>;
}

interface RawCompliance {
  shutterstock: RawPlatformChecks;
  getty: RawPlatformChecks;
  adobe: RawPlatformChecks;
}

// Getty reprova com warnings em qualidade técnica
const GETTY_QUALITY_CHECKS = ['sharpness', 'exposure', 'noise', 'technicalDefects'];

function buildPlatformCompliance(
  platform: PlatformKey,
  raw: RawPlatformChecks,
  metadata: ImageMetadata | undefined
): PlatformCompliance {
  const checks: ComplianceCheck[] = raw.checks.map(c => ({
    status: c.status as ComplianceCheck['status'],
    label: c.label,
    message: c.message,
  }));

  // Adiciona check de resolução a partir dos metadados do arquivo
  const req = PLATFORM_RESOLUTION_REQUIREMENTS[platform];
  if (metadata?.megapixels !== undefined) {
    const mp = metadata.megapixels;
    const dims = metadata.width && metadata.height
      ? ` (${metadata.width}×${metadata.height}px, ${mp.toFixed(1)} MP)`
      : ` (${mp.toFixed(1)} MP)`;

    if (mp < req.minMP) {
      checks.push({
        status: 'fail',
        label: 'Resolução',
        message: `Resolução insuficiente${dims}. Mínimo: ${req.label}.`,
      });
    } else {
      checks.push({
        status: 'pass',
        label: 'Resolução',
        message: `Resolução adequada${dims}. Mínimo exigido: ${req.label}.`,
      });
    }
  } else {
    checks.push({
      status: 'warning',
      label: 'Resolução',
      message: 'Não foi possível verificar a resolução original. Verifique se atinge ' + req.label + '.',
    });
  }

  // Getty: warnings em qualidade técnica viram fail
  const processedChecks = checks.map(check => {
    if (platform === 'getty' && GETTY_QUALITY_CHECKS.includes(
      raw.checks.find(r => r.label === check.label)?.checkId ?? ''
    )) {
      if (check.status === 'warning') {
        return { ...check, status: 'fail' as const, message: check.message + ' (Getty exige pass neste critério)' };
      }
    }
    return check;
  });

  const fails = processedChecks.filter(c => c.status === 'fail').length;
  const warnings = processedChecks.filter(c => c.status === 'warning').length;
  const passes = processedChecks.filter(c => c.status === 'pass').length;
  const total = processedChecks.length;

  const eligible = fails === 0;
  const score = Math.round(((passes + warnings * 0.5) / total) * 100);

  return { eligible, score, checks: processedChecks };
}

export function buildCompliance(
  rawCompliance: RawCompliance,
  metadata: ImageMetadata | undefined
): ImageCompliance {
  return {
    shutterstock: buildPlatformCompliance('shutterstock', rawCompliance.shutterstock, metadata),
    getty:        buildPlatformCompliance('getty',        rawCompliance.getty,        metadata),
    adobe:        buildPlatformCompliance('adobe',        rawCompliance.adobe,        metadata),
  };
}
