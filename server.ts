import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import SftpClient from 'ssh2-sftp-client';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ShutterstockConfig { apiKey: string; apiSecret: string; contributorId: string; }
interface GettyConfig        { sftpUser: string; sftpPassword: string; }
interface AdobeConfig        { apiKey: string; apiSecret: string; }

interface DistributionMetadata { title: string; keywords: string[]; description?: string; }

interface PlatformResult {
  platform:      string;
  status:        'success' | 'error';
  message:       string;
  submissionId?: string;
  portalUrl?:    string;
  timestamp:     string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function downloadImageBuffer(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} ao baixar imagem`);
  const contentType = res.headers.get('content-type') ?? 'image/jpeg';
  return { buffer: Buffer.from(await res.arrayBuffer()), contentType };
}

// ── Shutterstock ───────────────────────────────────────────────────────────────
//
// Flow:
//   1. Client Credentials OAuth2 → access_token
//   2. POST /v2/images/uploads   → { upload_id, upload_url }
//   3. PUT  upload_url           → binary upload
//   4. POST /v2/images           → submit for editorial review

async function distributeToShutterstock(
  imageBuffer: Buffer,
  imageName:   string,
  contentType: string,
  metadata:    DistributionMetadata,
  config:      ShutterstockConfig,
): Promise<PlatformResult> {
  const PORTAL = 'https://submit.shutterstock.com';
  const ts     = new Date().toISOString();
  const log    = (msg: string) => console.log(`[Shutterstock] ${msg}`);

  // 1 — OAuth2 access token
  const tokenRes = await fetch('https://api.shutterstock.com/v2/oauth/access_token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     config.apiKey,
      client_secret: config.apiSecret,
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    log(`Auth failed ${tokenRes.status}: ${body.slice(0, 200)}`);
    return {
      platform: 'Shutterstock', status: 'error', timestamp: ts, portalUrl: PORTAL,
      message: tokenRes.status === 401
        ? 'Credenciais inválidas. Verifique o Consumer Key e Secret nas Configurações.'
        : `Falha na autenticação (HTTP ${tokenRes.status}). Tente novamente.`,
    };
  }

  const { access_token: token } = await tokenRes.json() as { access_token: string };
  log('Token obtido.');

  // 2 — Initialize upload
  const initRes = await fetch('https://api.shutterstock.com/v2/images/uploads', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({ filename: imageName }),
  });

  if (!initRes.ok) {
    const body = await initRes.text().catch(() => '');
    log(`Init upload failed ${initRes.status}: ${body.slice(0, 200)}`);
    return {
      platform: 'Shutterstock', status: 'error', timestamp: ts, portalUrl: PORTAL,
      message: `Erro ao iniciar upload (HTTP ${initRes.status}). Sua conta pode não ter acesso de contribuidor ativo.`,
    };
  }

  const { upload_id, upload_url } = await initRes.json() as { upload_id: string; upload_url: string };
  log(`Upload iniciado: id=${upload_id}`);

  // 3 — Upload binary to pre-signed URL
  const putRes = await fetch(upload_url, {
    method:  'PUT',
    body:    imageBuffer,
    headers: { 'Content-Type': contentType },
  });

  if (!putRes.ok) {
    log(`File PUT failed ${putRes.status}`);
    return {
      platform: 'Shutterstock', status: 'error', timestamp: ts, portalUrl: PORTAL,
      message: `Erro ao enviar arquivo (HTTP ${putRes.status}).`,
    };
  }

  log('Arquivo enviado.');

  // 4 — Submit image for review
  const submitRes = await fetch('https://api.shutterstock.com/v2/images', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify({
      upload_id,
      description: metadata.title.slice(0, 200),
      keywords:    metadata.keywords.slice(0, 50),   // Shutterstock max 50
      editorial:   false,
      is_illustration: false,
    }),
  });

  if (!submitRes.ok) {
    const body = await submitRes.text().catch(() => '');
    log(`Submit failed ${submitRes.status}: ${body.slice(0, 200)}`);
    return {
      platform: 'Shutterstock', status: 'error', timestamp: ts, portalUrl: PORTAL,
      message: `Arquivo enviado, mas falhou ao registrar para revisão (HTTP ${submitRes.status}).`,
    };
  }

  const submitData = await submitRes.json() as { id?: string };
  log(`Submitted OK, id=${submitData.id}`);

  return {
    platform:     'Shutterstock',
    status:       'success',
    timestamp:    ts,
    message:      'Enviada com sucesso e aguardando revisão editorial.',
    submissionId: submitData.id,
    portalUrl:    PORTAL,
  };
}

// ── Adobe Stock ────────────────────────────────────────────────────────────────
//
// Flow:
//   1. Adobe IMS client_credentials → access_token
//   2. POST stock.adobe.io/v1/content/upload  (multipart)

async function distributeToAdobe(
  imageBuffer: Buffer,
  imageName:   string,
  contentType: string,
  metadata:    DistributionMetadata,
  config:      AdobeConfig,
): Promise<PlatformResult> {
  const PORTAL = 'https://contributor.stock.adobe.com';
  const ts     = new Date().toISOString();
  const log    = (msg: string) => console.log(`[Adobe Stock] ${msg}`);

  // 1 — Adobe IMS token
  const tokenRes = await fetch('https://ims-na1.adobelogin.com/ims/token/v3', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     config.apiKey,
      client_secret: config.apiSecret,
      scope:         'openid,AdobeID,stock_contributor',
    }),
  });

  if (!tokenRes.ok) {
    const body = await tokenRes.text().catch(() => '');
    log(`Auth failed ${tokenRes.status}: ${body.slice(0, 200)}`);
    return {
      platform: 'Adobe Stock', status: 'error', timestamp: ts, portalUrl: PORTAL,
      message: tokenRes.status === 400 || tokenRes.status === 401
        ? 'Credenciais Adobe inválidas ou sem permissão de contribuidor. Verifique nas Configurações.'
        : `Falha na autenticação Adobe IMS (HTTP ${tokenRes.status}).`,
    };
  }

  const { access_token: token } = await tokenRes.json() as { access_token: string };
  log('Token obtido.');

  // 2 — Upload via multipart form
  const form = new FormData();
  form.append('file',     new Blob([imageBuffer], { type: contentType }), imageName);
  form.append('title',    metadata.title.slice(0, 200));
  form.append('keywords', metadata.keywords.slice(0, 49).join(','));   // Adobe max 49

  const uploadRes = await fetch('https://stock.adobe.io/v1/content/upload', {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-api-key': config.apiKey },
    body:    form,
  });

  if (!uploadRes.ok) {
    const body = await uploadRes.text().catch(() => '');
    log(`Upload failed ${uploadRes.status}: ${body.slice(0, 200)}`);
    return {
      platform: 'Adobe Stock', status: 'error', timestamp: ts, portalUrl: PORTAL,
      message: `Erro ao enviar para Adobe Stock (HTTP ${uploadRes.status}). Verifique se a conta tem acesso de contribuidor ativo.`,
    };
  }

  const uploadData = await uploadRes.json() as { content_id?: string };
  log(`Submitted OK, content_id=${uploadData.content_id}`);

  return {
    platform:     'Adobe Stock',
    status:       'success',
    timestamp:    ts,
    message:      'Enviada com sucesso e aguardando revisão.',
    submissionId: uploadData.content_id,
    portalUrl:    PORTAL,
  };
}

// ── Getty Images / iStock (SFTP) ───────────────────────────────────────────────
//
// Getty Images does not offer a public contributor upload API.
// Submissions use SFTP: sftp.gettyimages.com (port 22).
// iStock is a Getty subsidiary and shares the same SFTP pipeline.
//
// Flow:
//   1. Connect to sftp.gettyimages.com with contributor credentials
//   2. Upload image file to /uploads/
//   3. Upload companion XML with title, keywords, destination (Getty or iStock)
//   4. Getty processes both files automatically

function buildGettyXml(
  filename: string,
  metadata: DistributionMetadata,
  destination: 'Getty' | 'iStock'
): string {
  const keywords = metadata.keywords.slice(0, 50).join(',');
  const title    = metadata.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 200);
  const desc     = (metadata.description ?? metadata.title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').slice(0, 500);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Assets>
  <Asset>
    <Filename>${filename}</Filename>
    <Title>${title}</Title>
    <Description>${desc}</Description>
    <Keywords>${keywords}</Keywords>
    <Destination>${destination}</Destination>
    <Exclusive>false</Exclusive>
    <Editorial>false</Editorial>
  </Asset>
</Assets>`;
}

async function distributeViaGettySFTP(
  imageBuffer: Buffer,
  imageName:   string,
  metadata:    DistributionMetadata,
  config:      GettyConfig,
  destination: 'Getty' | 'iStock',
): Promise<PlatformResult> {
  const PORTAL = 'https://contributor.gettyimages.com';
  const ts     = new Date().toISOString();
  const platform = destination === 'iStock' ? 'iStock' : 'Getty Images';
  const log    = (msg: string) => console.log(`[${platform}] ${msg}`);

  const sftp = new SftpClient();
  try {
    log(`Conectando a sftp.gettyimages.com como ${config.sftpUser}...`);
    await sftp.connect({
      host:     'sftp.gettyimages.com',
      port:     22,
      username: config.sftpUser,
      password: config.sftpPassword,
      readyTimeout: 20000,
    });

    const remotePath = `/uploads/${imageName}`;
    const xmlName    = imageName.replace(/\.[^/.]+$/, '') + '.xml';
    const xmlPath    = `/uploads/${xmlName}`;
    const xmlContent = buildGettyXml(imageName, metadata, destination);

    log(`Enviando imagem → ${remotePath}`);
    await sftp.put(imageBuffer, remotePath);

    log(`Enviando metadados → ${xmlPath}`);
    await sftp.put(Buffer.from(xmlContent, 'utf-8'), xmlPath);

    log('Upload concluído com sucesso.');
    return {
      platform,
      status:    'success',
      timestamp: ts,
      portalUrl: PORTAL,
      message:   `Arquivo enviado via SFTP. O ${platform} processará a submissão em breve — acompanhe em contributor.gettyimages.com.`,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`Erro SFTP: ${msg}`);

    const friendly = msg.includes('Authentication') || msg.includes('authentication')
      ? 'Credenciais SFTP inválidas. Verifique usuário e senha nas Configurações.'
      : msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')
        ? 'Não foi possível conectar ao servidor SFTP. Verifique sua conexão.'
        : `Erro no upload SFTP: ${msg}`;

    return { platform, status: 'error', timestamp: ts, portalUrl: PORTAL, message: friendly };
  } finally {
    await sftp.end().catch(() => {});
  }
}

// ── Server ─────────────────────────────────────────────────────────────────────

async function startServer() {
  const app  = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // ── Proxy Firebase Auth handler ───────────────────────────────────────────────
  // Necessário para iOS Safari: mantém o fluxo OAuth no mesmo domínio do app,
  // evitando que o ITP do Safari apague o estado de redirect do IndexedDB.
  const FIREBASE_PROJECT = 'gen-lang-client-0469527602';
  app.use('/__/', async (req, res) => {
    try {
      const qs    = new URLSearchParams(req.query as Record<string, string>).toString();
      const url   = `https://${FIREBASE_PROJECT}.firebaseapp.com/__${req.path}${qs ? '?' + qs : ''}`;
      const upstream = await fetch(url, {
        method:  req.method,
        headers: { 'user-agent': req.headers['user-agent'] ?? '', accept: req.headers.accept ?? '*/*' },
      });
      const ct = upstream.headers.get('content-type') ?? 'text/html';
      res.setHeader('content-type', ct);
      res.status(upstream.status);
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch (err) {
      console.error('[AuthProxy] erro:', err);
      res.status(502).send('Auth proxy error');
    }
  });

  // ── POST /api/distribute ──────────────────────────────────────────────────────
  app.post('/api/distribute', async (req, res) => {
    const { imageId, imageUrl, imageName, platforms, metadata, config } = req.body as {
      imageId:   string;
      imageUrl:  string;
      imageName: string;
      platforms: string[];
      metadata:  DistributionMetadata;
      config: {
        shutterstock?: ShutterstockConfig;
        getty?:        GettyConfig;
        adobe?:        AdobeConfig;
      };
    };

    if (!imageUrl) {
      res.status(400).json({ success: false, message: 'imageUrl é obrigatório.' });
      return;
    }

    console.log(`[DISTRIBUTE] imageId=${imageId} → ${platforms.join(', ')}`);

    // Download image once, reuse for all platforms
    let imageBuffer: Buffer;
    let contentType: string;

    try {
      ({ buffer: imageBuffer, contentType } = await downloadImageBuffer(imageUrl));
      console.log(`[DISTRIBUTE] Imagem baixada: ${imageBuffer.byteLength} bytes, type=${contentType}`);
    } catch (err) {
      console.error('[DISTRIBUTE] Falha ao baixar imagem:', err);
      res.status(500).json({
        success: false,
        message: 'Não foi possível baixar a imagem para distribuição.',
        details: [],
      });
      return;
    }

    const safeImageName = (imageName ?? `image_${imageId}`).replace(/[^a-z0-9._-]/gi, '_');
    const results: PlatformResult[] = [];

    for (const platform of platforms) {
      try {
        if (platform === 'Shutterstock') {
          if (!config.shutterstock?.apiKey) throw new Error('Configuração do Shutterstock ausente.');
          results.push(await distributeToShutterstock(imageBuffer, safeImageName, contentType, metadata, config.shutterstock));

        } else if (platform === 'Getty Images') {
          if (!config.getty?.sftpUser) throw new Error('Credenciais SFTP do Getty ausentes.');
          results.push(await distributeViaGettySFTP(imageBuffer, safeImageName, metadata, config.getty, 'Getty'));

        } else if (platform === 'iStock') {
          if (!config.getty?.sftpUser) throw new Error('Credenciais SFTP do Getty/iStock ausentes.');
          results.push(await distributeViaGettySFTP(imageBuffer, safeImageName, metadata, config.getty, 'iStock'));

        } else if (platform === 'Adobe Stock') {
          if (!config.adobe?.apiKey) throw new Error('Configuração do Adobe Stock ausente.');
          results.push(await distributeToAdobe(imageBuffer, safeImageName, contentType, metadata, config.adobe));

        } else {
          results.push({
            platform, status: 'error', timestamp: new Date().toISOString(),
            message: `Plataforma desconhecida: ${platform}.`,
          });
        }
      } catch (err) {
        console.error(`[${platform}] Erro inesperado:`, err);
        results.push({
          platform, status: 'error', timestamp: new Date().toISOString(),
          message: err instanceof Error ? err.message : 'Erro inesperado.',
        });
      }
    }

    const allSuccess = results.every(r => r.status === 'success');
    const anySuccess = results.some(r => r.status === 'success');

    res.json({
      success: allSuccess,
      message: allSuccess
        ? 'Distribuição concluída com sucesso em todas as plataformas!'
        : anySuccess
          ? 'Distribuição parcialmente concluída.'
          : 'Nenhuma plataforma aceitou o envio.',
      details: results,
    });
  });

  // ── Vite / static ─────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, response) => response.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on http://localhost:${PORT}`));
}

startServer();
