// node-api/src/services/datasources/testCsv.js

import fs from 'fs';
import readline from 'readline';
import path from 'path';

// --- Helper para encontrar o arquivo CSV único no diretório ---
const findSingleCsvInDir = async (directoryPath) => {
  const basePath = process.cwd();
  
  // LIMPEZA: Remove aspas duplas/simples e espaços extras que podem vir do input
  const cleanPath = directoryPath.replace(/["']/g, "").trim();
  
  const absolutePath = path.resolve(basePath, cleanPath);

  // LOG DE DEBUG: Veja isso no console do Portainer/Docker se der erro
  console.log(`[CSV TEST] Base: ${basePath}`);
  console.log(`[CSV TEST] Input: ${directoryPath}`);
  console.log(`[CSV TEST] Buscando em: ${absolutePath}`);

  let stats;
  try {
    stats = await fs.promises.stat(absolutePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      throw new Error(`DIR_NOT_FOUND: O diretório '${absolutePath}' não foi encontrado.`);
    }
    throw err;
  }

  if (!stats.isDirectory()) {
    throw new Error(`NOT_A_DIRECTORY: O caminho '${absolutePath}' não é um diretório.`);
  }

  const files = await fs.promises.readdir(absolutePath);
  const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));

  console.log(`[CSV TEST] Arquivos encontrados: ${files.join(', ')}`);

  if (csvFiles.length === 0) {
    throw new Error("NO_CSV_FOUND: Nenhum arquivo CSV (.csv) encontrado no diretório.");
  }
  if (csvFiles.length > 1) {
    throw new Error(`MULTIPLE_CSV_FOUND: Múltiplos arquivos CSV encontrados (${csvFiles.join(', ')}). O diretório deve conter apenas um.`);
  }

  return path.join(absolutePath, csvFiles[0]);
};


export const testCsvConnection = async (req, res) => {
  const { diretorio } = req.body;

  if (!diretorio) {
    return res.status(400).json({ message: "O 'diretorio' (pasta) é obrigatório." });
  }

  try {
    // 1. Encontra o caminho exato
    const csvFilePath = await findSingleCsvInDir(diretorio);

    console.log(`[CSV TEST] Lendo arquivo: ${csvFilePath}`);

    // 2. Cria stream
    const fileStream = fs.createReadStream(csvFilePath);

    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    // 3. Lê a primeira linha
    let firstLine = null;
    for await (const line of rl) {
      firstLine = line;
      break; 
    }
    rl.close();
    fileStream.close(); // Garante fechamento do stream

    if (firstLine) {
      return res.status(200).json({ success: true, header: firstLine });
    } else {
      return res.status(400).json({ message: "O arquivo CSV encontrado está vazio." });
    }

  } catch (error) {
    console.error("[CSV TEST ERROR]", error);

    // Captura erros customizados do helper
    if (error.message.startsWith('DIR_NOT_FOUND') || error.message.startsWith('NOT_A_DIRECTORY')) {
      return res.status(404).json({ message: error.message.split(': ')[1] });
    }
    if (error.message.startsWith('NO_CSV_FOUND') || error.message.startsWith('MULTIPLE_CSV_FOUND')) {
      return res.status(400).json({ message: error.message.split(': ')[1] });
    }
    
    if (error.code === 'ENOENT') {
      return res.status(404).json({ message: "Arquivo não encontrado." });
    }
    if (error.code === 'EACCES') {
      return res.status(403).json({ message: "ERRO DE PERMISSÃO: O sistema não consegue ler a pasta. Verifique o dono do arquivo." });
    }

    // Retorna o erro real para ajudar no debug
    return res.status(500).json({ message: `Erro interno: ${error.message}` });
  }
};