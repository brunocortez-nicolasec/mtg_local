import axios from 'axios';
import { parseStringPromise } from 'xml2js';

export const testApiConnection = async (req, res) => {
  const { 
    apiUrl, 
    method = 'GET', 
    headers, 
    body, 
    responsePath // Caminho opcional para achar os dados (ex: "data.users" ou "soap:Envelope...")
  } = req.body;

  if (!apiUrl) {
    return res.status(400).json({ message: "A URL da API é obrigatória." });
  }

  // Configura a requisição
  const config = {
    method: method,
    url: apiUrl,
    headers: headers || {},
    timeout: 10000 // 10 segundos de limite
  };

  // Se tiver body (para POST/SOAP), adiciona
  if (body) {
    config.data = body;
  }

  try {
    const startTime = Date.now();
    const response = await axios(config);
    const duration = Date.now() - startTime;

    let finalData = response.data;
    let detectedColumns = [];

    // --- Lógica SOAP (XML) ---
    // Se o header indicar XML ou a resposta começar com <, tentamos converter
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
    // Se o usuário disse onde estão os dados (ex: "data.results"), vamos navegar até lá
    if (responsePath) {
        const pathParts = responsePath.split('.');
        let current = finalData;
        for (const part of pathParts) {
            if (current[part] !== undefined) {
                current = current[part];
            }
        }
        finalData = current;
    }

    // --- Tentativa de Identificar Colunas ---
    // Precisamos de um array para listar colunas. 
    // Se finalData for array, pegamos o primeiro item.
    // Se for objeto, tentamos achar algum array dentro dele automaticamente.
    let dataArray = [];
    if (Array.isArray(finalData)) {
        dataArray = finalData;
    } else if (typeof finalData === 'object' && finalData !== null) {
        // Tenta achar a primeira chave que seja um array (comum em respostas JSON: { users: [...] })
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
      detectedColumns: detectedColumns, // Retorna para o Frontend popular o dropdown
      preview: dataArray.slice(0, 2) // Retorna uma amostra
    });

  } catch (error) {
    console.error("Erro no teste de API:", error.message);
    const status = error.response ? error.response.status : 500;
    const msg = error.response ? `Erro da API (${status}): ${JSON.stringify(error.response.data)}` : error.message;
    
    return res.status(status).json({ message: `Falha na conexão: ${msg}` });
  }
};