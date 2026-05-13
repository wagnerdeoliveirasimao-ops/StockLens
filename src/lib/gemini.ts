import { GoogleGenAI, Type } from '@google/genai';

export const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const GEMINI_MODEL = 'gemini-2.5-flash';

export const ANALYSIS_PROMPT = `Analise esta imagem para dois fins:

1. POTENCIAL COMERCIAL em plataformas de stock (Shutterstock, Getty Images, Adobe Stock).
2. CONFORMIDADE TÉCNICA com os padrões mínimos de cada plataforma.

Para a conformidade, avalie os seguintes critérios visuais (a resolução será verificada separadamente):

CRITÉRIOS A AVALIAR:
- sharpness: A imagem está nítida e em foco? (fail = desfocada/tremida, warning = levemente suave, pass = nítida)
- exposure: A exposição está correta? (fail = muito escura/clara com perda de detalhes, warning = levemente sub/superexposta, pass = bem exposta)
- noise: O nível de ruído/grão é aceitável? (fail = ruído excessivo, warning = ruído perceptível, pass = limpa)
- technicalDefects: Há artefatos, aberração cromática, banding ou compressão excessiva? (fail = defeitos graves, warning = defeitos leves, pass = sem defeitos)
- watermarks: Há marcas d'água, logos ou textos sobrepostos? (fail = sim, pass = não)
- brandLogos: Marcas/logos de terceiros são o foco principal? (fail = sim, warning = visíveis mas não são foco, pass = não)
- modelRelease: Há pessoas identificáveis (rostos visíveis)? (warning = sim — release necessário para uso comercial, pass = não)
- propertyRelease: Há propriedade privada, edifícios tombados ou obras de arte reconhecíveis? (warning = sim — release pode ser necessário, pass = não)
- copyright: Há conteúdo protegido por copyright claramente visível (telas com conteúdo, obras de arte, etc.)? (fail = sim, pass = não)

PADRÕES POR PLATAFORMA:
- Shutterstock: aceita ruído leve (warning), exposição com warning. Reprovado por watermarks, copyright, brandLogos como foco.
- Getty Images (mais exigente): exige pass em sharpness, exposure, noise e technicalDefects. Warnings em qualidade técnica resultam em reprovação.
- Adobe Stock: padrões similares ao Shutterstock.

Retorne um JSON com:
- score: número (1-100) representando o potencial comercial geral.
- keywords: string[] com 10-15 palavras-chave relevantes em português.
- trends: string explicando como se encaixa nas tendências visuais atuais.
- commercialPotential: string explicando o potencial comercial.
- suggestions: string[] com recomendações práticas de melhoria.
- editingGuide: objeto com exposure, contrast, saturation, highlights, shadows, colorTemp, cropSuggestion.
- compliance: objeto com shutterstock, getty, adobe — cada um com array "checks" contendo objetos {checkId, status, label, message}.

IMPORTANTE: Todas as descrições em texto devem estar em PORTUGUÊS (Brasil).`;

const CHECK_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    checkId:  { type: Type.STRING },
    status:   { type: Type.STRING },
    label:    { type: Type.STRING },
    message:  { type: Type.STRING },
  },
  required: ['checkId', 'status', 'label', 'message'],
};

const PLATFORM_COMPLIANCE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    checks: { type: Type.ARRAY, items: CHECK_SCHEMA },
  },
  required: ['checks'],
};

export const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    score:               { type: Type.NUMBER },
    keywords:            { type: Type.ARRAY, items: { type: Type.STRING } },
    trends:              { type: Type.STRING },
    commercialPotential: { type: Type.STRING },
    suggestions:         { type: Type.ARRAY, items: { type: Type.STRING } },
    editingGuide: {
      type: Type.OBJECT,
      properties: {
        exposure:        { type: Type.STRING },
        contrast:        { type: Type.STRING },
        saturation:      { type: Type.STRING },
        highlights:      { type: Type.STRING },
        shadows:         { type: Type.STRING },
        colorTemp:       { type: Type.STRING },
        cropSuggestion:  { type: Type.STRING },
      },
      required: ['exposure', 'contrast', 'saturation', 'highlights', 'shadows', 'colorTemp', 'cropSuggestion'],
    },
    compliance: {
      type: Type.OBJECT,
      properties: {
        shutterstock: PLATFORM_COMPLIANCE_SCHEMA,
        getty:        PLATFORM_COMPLIANCE_SCHEMA,
        adobe:        PLATFORM_COMPLIANCE_SCHEMA,
      },
      required: ['shutterstock', 'getty', 'adobe'],
    },
  },
  required: ['score', 'keywords', 'trends', 'commercialPotential', 'suggestions', 'editingGuide', 'compliance'],
};

// Requisitos mínimos de resolução por plataforma (em megapixels)
export const PLATFORM_RESOLUTION_REQUIREMENTS = {
  shutterstock: { minMP: 4,  label: '4 MP mínimo (aprox. 2400×1600px)' },
  getty:        { minMP: 6,  label: '6 MP mínimo (aprox. 3000×2000px)' },
  adobe:        { minMP: 4,  label: '4 MP mínimo (aprox. 2400×1600px)' },
} as const;
