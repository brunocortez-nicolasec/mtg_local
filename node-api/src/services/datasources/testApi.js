import axios from 'axios';
import { parseStringPromise } from 'xml2js';

export const testApiConnection = async (req, res) => {
  let { 
    apiUrl, 
    method = 'GET', 
    headers, 
    body, 
    responsePath,
    // Novos campos para Auth Dinâmica
    auth_is_dynamic,
    auth_token_url,
    auth_client_id,
    auth_client_secret,
    auth_grant_type,
    auth_scope
  } = req.body;

  if (!apiUrl) {
    return res.status(400).json({ message: "A URL da API é obrigatória." });
  }

  // Inicializa headers se não existirem
  headers = headers || {};

  try {
    // ==================================================================
    // 1. FLUXO DE TOKEN DINÂMICO (OAUTH2 / CLIENT CREDENTIALS)
    // ==================================================================
    if (auth_is_dynamic && auth_token_url && auth_client_id) {
        try {
            const params = new URLSearchParams();
            params.append('client_id', auth_client_id);
            if (auth_client_secret) params.append('client_secret', auth_client_secret);
            params.append('grant_type', auth_grant_type || 'client_credentials');
            if (auth_scope) params.append('scope', auth_scope);

            const tokenResponse = await axios.post(auth_token_url, params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 5000
            });

            const token = tokenResponse.data.access_token || tokenResponse.data.token;
            
            if (token) {
                // Injeta o token gerado no header da requisição principal
                headers['Authorization'] = `Bearer ${token}`;
            } else {
                throw new Error("Token não encontrado na resposta do provedor de identidade.");
            }

        } catch (tokenError) {
            const msg = tokenError.response?.data ? JSON.stringify(tokenError.response.data) : tokenError.message;
            return res.status(401).json({ message: `Falha ao obter Token Dinâmico: ${msg}` });
        }
    }

    // ==================================================================
    // 2. REQUISIÇÃO PRINCIPAL
    // ==================================================================
    const config = {
      method: method,
      url: apiUrl,
      headers: headers,
      timeout: 10000 // 10 segundos de limite
    };

    // Se tiver body (para POST/SOAP), adiciona
    if (body) {
      config.data = body;
    }

    const startTime = Date.now();
    const response = await axios(config);
    const duration = Date.now() - startTime;

    let finalData = response.data;
    let detectedColumns = [];

    // --- Lógica SOAP (XML) ---
    const contentType = response.headers['content-type'] || '';
    const isXml = contentType.includes('xml') || (typeof response.data === 'string' && response.data.trim().startsWith('<'));

    if (isXml) {
        try {
            // Converte XML para JSON
            const parsed = await parseStringPromise(response.data, { explicitArray: false, ignoreAttrs: true });
            finalData = parsed; // Agora é um objeto JS
        } catch (xmlError) {
            return res.status(200).json({ 
                message: "Conexão OK, mas falha ao converter XML. Verifique se é um SOAP válido.",
                rawResponse: response.data.substring(0, 200) + "..."
            });
        }
    }

    // --- Navegação pelo Response Path ---
    if (responsePath) {
        const pathParts = responsePath.split('.');
        let current = finalData;
        for (const part of pathParts) {
            if (current && current[part] !== undefined) {
                current = current[part];
            } else {
                // Se o path falhar, mantemos o que achamos até agora ou null, 
                // mas não falhamos a requisição, apenas avisamos.
                break;
            }
        }
        // Se achou algo, atualiza. Se não, mantém o original para debug.
        if (current) finalData = current;
    }

    // --- Tentativa de Identificar Colunas ---
    let dataArray = [];
    if (Array.isArray(finalData)) {
        dataArray = finalData;
    } else if (typeof finalData === 'object' && finalData !== null) {
        // Tenta achar a primeira chave que seja um array
        const arrayKey = Object.keys(finalData).find(key => Array.isArray(finalData[key]));
        if (arrayKey) {
            dataArray = finalData[arrayKey];
        } else {
            // Se não achou array, assume que o próprio objeto é um item único
            dataArray = [finalData];
        }
    }

    if (dataArray.length > 0) {
        detectedColumns = Object.keys(dataArray[0]);
    }

    return res.status(200).json({
      message: `Sucesso! Status ${response.status}. Tempo: ${duration}ms.`,
      detectedColumns: detectedColumns, 
      preview: dataArray.slice(0, 2),
      fullResponse: finalData // ADIÇÃO IMPORTANTE: Permite que o frontend inspecione a resposta completa (ex: para pegar o token no teste de botão)
    });

  } catch (error) {
    console.error("Erro no teste de API:", error.message);
    const status = error.response ? error.response.status : 500;
    const msg = error.response ? `Erro da API (${status}): ${JSON.stringify(error.response.data)}` : error.message;
    
    return res.status(status).json({ message: `Falha na conexão: ${msg}` });
  }
};