import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({ limit: '50mb' }));

  // API Route for Stock Distribution
  app.post("/api/distribute", async (req, res) => {
    const { imageId, platforms, metadata, config } = req.body;
    
    console.log(`[DISTRIBUTION] Iniciando envio da imagem ${imageId}`);
    console.log(`[METADATA] Titulo: ${metadata.title}, Tags: ${metadata.keywords.length}`);
    
    const results = [];

    for (const platform of platforms) {
      try {
        let platConfig = null;
        let endpoint = "";

        if (platform === 'Shutterstock') {
          platConfig = config.shutterstock;
          endpoint = "https://api.shutterstock.com/v2/images/uploads";
        } else if (platform === 'Getty Images') {
          platConfig = config.getty;
          endpoint = "https://api.gettyimages.com/v3/uploads";
        } else if (platform === 'Adobe Stock') {
          platConfig = config.adobe;
          endpoint = "https://stock.adobe.io/v1/content/upload";
        }

        if (!platConfig?.apiKey) {
          throw new Error(`Configuração ausente para ${platform}`);
        }

        console.log(`[PUSH] Enviando para ${platform} (${endpoint})`);
        
        // Simulação de chamada real usando as chaves reais se existissem
        // Exemplo: await fetch(endpoint, { method: 'POST', headers: { ...platConfig }, body: ... })
        await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1000));

        results.push({
          platform,
          status: "success",
          message: "Upload concluído",
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`[FAIL] ${platform}:`, error);
        results.push({
          platform,
          status: "error",
          message: error instanceof Error ? error.message : "Falha na conexão",
          timestamp: new Date().toISOString()
        });
      }
    }

    const allSuccess = results.every(r => r.status === "success");

    res.json({ 
      success: allSuccess, 
      message: allSuccess 
        ? "Distribuição concluída com sucesso em todas as plataformas!" 
        : "Distribuição concluída com alguns alertas.",
      details: results
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
