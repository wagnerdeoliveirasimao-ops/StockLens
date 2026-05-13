export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  };
}

export interface AnalysisResult {
  id: string;
  userId: string;
  name: string;
  url: string;
  originalUrl?: string | null;
  score: number;
  keywords: string[];
  trends: string;
  commercialPotential: string;
  suggestions: string[];
  editingGuide?: {
    exposure: string;
    contrast: string;
    saturation: string;
    highlights: string;
    shadows: string;
    colorTemp: string;
    cropSuggestion: string;
  };
  storagePath?: string;
  compliance?: ImageCompliance;
  imageMetadata?: ImageMetadata;
  timestamp: number;
}

export interface UserSettings {
  shutterstock?: { apiKey: string; apiSecret: string; contributorId: string };
  getty?: { apiKey: string; apiSecret: string };
  adobe?: { apiKey: string; apiSecret: string };
}

export type View = 'dashboard' | 'history' | 'trends' | 'settings';

// ── Compliance ────────────────────────────────────────────────────────────────

export type ComplianceStatus = 'pass' | 'warning' | 'fail';

export interface ComplianceCheck {
  status: ComplianceStatus;
  label: string;
  message: string;
}

export interface PlatformCompliance {
  eligible: boolean;   // pode ser submetida (sem nenhum "fail" bloqueante)
  score: number;       // 0-100: % dos checks que passaram ou são warnings
  checks: ComplianceCheck[];
}

export interface ImageCompliance {
  shutterstock: PlatformCompliance;
  getty: PlatformCompliance;
  adobe: PlatformCompliance;
}

export interface ImageMetadata {
  width?: number;
  height?: number;
  megapixels?: number;
}

// ── Batch ──────────────────────────────────────────────────────────────────────
export type BatchStatus = 'queued' | 'analyzing' | 'done' | 'error';

export interface BatchItem {
  id: string;
  file: File;
  name: string;
  status: BatchStatus;
  error?: string;
}
