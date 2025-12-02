import fs from 'fs';
import readline from 'readline';
import path from 'path';

// --- Helper para encontrar o arquivo CSV único no diretório ---
const findSingleCsvInDir = async (directoryPath) => {
  // Em Docker/Linux, o caminho base costuma ser /usr/src/app
  const basePath = process.cwd(); 
  
  // LIMPEZA BLINDADA: 
  const cleanPath = directoryPath.replace(/["']/g, "").trim().replace(/^[\.\/]+/, "");
  
  // path.join é mais seguro que resolve aqui, pois concatena estritamente
  const absolutePath = path.join(basePath, cleanPath);

  // --- LOGS DE DEBUG (Aparecerão no console do Portainer) ---
  console.log(`[CSV TEST] ------------------------------------------------`);
  console.log(`[CSV TEST] Base (CWD): ${basePath}`);
  console.log(`[CSV TEST] Input User: ${directoryPath}`);
  console.log(`[CSV TEST] Path Limpo: ${cleanPath}`);
  console.log(`[CSV TEST] Buscando em: ${absolutePath}`);

  let stats;
  try {
    stats = await fs.promises.stat(absolutePath);
  } catch (err) {
    if (err.code === 'ENOENT') {
      // DEBUG AVANÇADO: Se falhar, lista o que TEM na pasta para sabermos o motivo
      console.error(`[CSV ERROR] A pasta não foi encontrada: ${absolutePath}`);
      try {
        const rootContent = await fs.promises.readdir(basePath);
        console.error(`[CSV DEBUG] Conteúdo da raiz (${basePath}): [${rootContent.join(', ')}]`);
        
        if (cleanPath.startsWith('public')) {
           const publicPath = path.join(basePath, 'public');
           const publicContent = await fs.promises.readdir(publicPath).catch(() => ["(Erro ao ler public)"]);
           console.error(`[CSV DEBUG] Conteúdo de 'public': [${publicContent.join(', ')}]`);
        }
      } catch (e) { /* ignorar erro de log */ }

      throw new Error(`DIR_NOT_FOUND: O sistema buscou em '${absolutePath}' mas a pasta não existe ou está inacessível.`);
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
    throw new Error("NO_CSV_FOUND: Nenhum arquivo CSV (.csv) encontrado nesta pasta.");
  }
  if (csvFiles.length > 1) {
    throw new Error(`MULTIPLE_CSV_FOUND: Encontrados múltiplos CSVs (${csvFiles.join(', ')}). Deixe apenas um.`);
  }

  return path.join(absolutePath, csvFiles[0]);
};


export const testCsvConnection = async (req, res) => {
  // --- ALTERAÇÃO: Recebe delimitador e aspas (com valores padrão) ---
  const { diretorio, delimiter = ",", quote = '"' } = req.body;

  if (!diretorio) {
    return res.status(400).json({ message: "O campo 'diretório' é obrigatório." });
  }

  try {
    const csvFilePath = await findSingleCsvInDir(diretorio);
    console.log(`[CSV TEST] Sucesso! Lendo arquivo: ${csvFilePath}`);
    console.log(`[CSV TEST] Configuração: Delimitador [${delimiter}] | Aspas [${quote}]`);

    const fileStream = fs.createReadStream(csvFilePath);
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let firstLine = null;
    for await (const line of rl) {
      firstLine = line;
      break; 
    }
    rl.close();
    fileStream.close();

    if (firstLine) {
      // --- ALTERAÇÃO: Tenta detectar colunas baseado no delimitador escolhido ---
      // Isso ajuda o frontend a mostrar "Encontrado (X colunas)" para o usuário validar
      const columns = firstLine.split(delimiter);

      return res.status(200).json({ 
          success: true, 
          header: firstLine,
          detectedColumns: columns.length 
      });
    } else {
      return res.status(400).json({ message: "O arquivo CSV está vazio." });
    }

  } catch (error) {
    console.error("[CSV TEST EXCEPTION]", error);

    // Tratamento de erros conhecidos para feedback amigável
    if (error.message.startsWith('DIR_NOT_FOUND') || 
        error.message.startsWith('NOT_A_DIRECTORY') || 
        error.message.startsWith('NO_CSV_FOUND') || 
        error.message.startsWith('MULTIPLE_CSV_FOUND')) {
      return res.status(400).json({ message: error.message.split(': ')[1] });
    }
    
    return res.status(500).json({ message: `Erro interno no servidor: ${error.message}` });
  }
};