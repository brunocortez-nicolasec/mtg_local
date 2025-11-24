// node-api/src/services/imports/index.js
import express from "express";
import passport from "passport";
import multer from "multer";
import { PrismaClient } from '@prisma/client';
import Papa from "papaparse";
import fs from 'fs';
import path from 'path';
// Importação do driver PostgreSQL para conexão direta
import pkg from 'pg';
const { Client } = pkg;

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ===========================================================================
// 1. HELPERS DE LEITURA (ARQUIVO E BANCO) - INALTERADOS
// ===========================================================================

// Helper: Encontrar arquivo CSV único no diretório
const findSingleCsvInDir = async (directoryPath) => {
  const basePath = process.cwd();
  const absolutePath = path.resolve(basePath, directoryPath);

  let stats;
  try {
    stats = await fs.promises.stat(absolutePath);
  } catch (err) {
    throw new Error(`O diretório '${directoryPath}' não foi encontrado no servidor.`);
  }

  if (!stats.isDirectory()) {
    throw new Error(`O caminho '${directoryPath}' não é um diretório.`);
  }

  const files = await fs.promises.readdir(absolutePath);
  const csvFiles = files.filter(file => file.toLowerCase().endsWith('.csv'));

  if (csvFiles.length === 0) {
    throw new Error("Nenhum arquivo CSV (.csv) foi encontrado no diretório especificado.");
  }
  if (csvFiles.length > 1) {
    throw new Error(`Múltiplos arquivos CSV encontrados. O diretório deve conter apenas um único arquivo CSV.`);
  }

  return path.join(absolutePath, csvFiles[0]);
};

// Helper: Buscar dados de um Banco de Dados externo
const fetchDataFromDatabase = async (dbConfig, tableName) => {
    if (!dbConfig) throw new Error("Configuração de banco de dados ausente.");
    if (!tableName) throw new Error("Nome da tabela não especificado.");

    let clientConfig = {};

    if (dbConfig.db_connection_type === 'URL') {
        if (!dbConfig.db_url) throw new Error("URL de conexão ausente.");
        clientConfig = { connectionString: dbConfig.db_url, connectionTimeoutMillis: 10000 };
    } else {
        if (!dbConfig.db_host || !dbConfig.db_user || !dbConfig.db_name) throw new Error("Dados de conexão incompletos.");
        clientConfig = {
            host: dbConfig.db_host,
            port: parseInt(dbConfig.db_port || 5432, 10),
            user: dbConfig.db_user,
            password: dbConfig.db_password,
            database: dbConfig.db_name,
            connectionTimeoutMillis: 10000
        };
    }

    const client = new Client(clientConfig);
    try {
        await client.connect();
        
        const schema = dbConfig.db_schema || 'public';
        const query = `SELECT * FROM "${schema}"."${tableName}"`;
        
        const res = await client.query(query);
        await client.end();
        
        return res.rows; // Retorna array de objetos
    } catch (error) {
        try { await client.end(); } catch(e) {}
        throw new Error(`Erro ao buscar dados do banco: ${error.message}`);
    }
};

// ===========================================================================
// 2. LÓGICAS DE PROCESSAMENTO (CORE) - SIMPLIFICADAS
// ===========================================================================

/**
 * Processa e salva dados da FONTE AUTORITATIVA (RH)
 */
const processAndSaveData_RH = async (db, dataSourceId, rows, mapeamento) => {
  let processedCount = 0;
  const warningsOrErrors = [];

  // Limpa dados antigos (OPERAÇÃO NÃO-ATÔMICA)
  await db.identitiesHR.deleteMany({ where: { dataSourceId: dataSourceId } });

  for (const [index, csvRow] of rows.entries()) {
    const linhaNum = index + 2; 
    const dataToSave = {};

    try { // TRY-CATCH POR LINHA
        // Mapeamento
        for (const [appColumn, csvColumn] of Object.entries(mapeamento)) {
            if (appColumn === "id" || appColumn === "dataSourceId") continue;
            if (csvColumn && csvRow[csvColumn] !== undefined) {
                // --- CORREÇÃO: Tratar NULL/UNDEFINED/Whitespace ---
                const rawValue = csvRow[csvColumn];
                dataToSave[appColumn] = (rawValue !== null && rawValue !== undefined) 
                                        ? String(rawValue).trim() 
                                        : '';
                // --- FIM CORREÇÃO ---
            }
        }
        
        // Validação Obrigatória
        const requiredFields = ['identity_id_hr', 'email_hr', 'status_hr'];
        const missingFields = [];
        for (const field of requiredFields) {
            if (!dataToSave[field]) missingFields.push(field);
        }

        if (missingFields.length > 0) {
            warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Campos obrigatórios vazios: [${missingFields.join(', ')}].`);
            continue; // Pula para a próxima linha
        }

        // Salvar (usando 'db' global)
        dataToSave.dataSourceId = dataSourceId; 
        await db.identitiesHR.create({ data: dataToSave });
        processedCount++;
    } catch (dbError) {
        warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Erro fatal no banco: ${dbError.message}`);
    }
  }

  return { processedCount, warningsOrErrors };
};

/**
 * Processa e salva dados de CONTAS (SISTEMA) e suas ATRIBUIÇÕES
 */
const processAndSaveData_Contas = async (db, systemId, rows, mapeamento, resourceCache) => {
  let processedCount = 0;
  const warningsOrErrors = [];
  
  // Limpa dados antigos (OPERAÇÃO NÃO-ATÔMICA)
  await db.assignment.deleteMany({ where: { account: { systemId: systemId } } });
  await db.accounts.deleteMany({ where: { systemId: systemId } });

  if (resourceCache.size === 0) {
    warningsOrErrors.push("AVISO GERAL: Nenhum Recurso foi encontrado no catálogo. Nenhuma atribuição será criada.");
  }

  for (const [index, csvRow] of rows.entries()) {
    const linhaNum = index + 2; 
    const dataToSave = {};
    let identityBusinessKey = null; 
    let resourceNamesString = null; 
    let identityId = null; 

    try { // TRY-CATCH POR LINHA
        // Mapeamento
        for (const [dbColumn, csvColumn] of Object.entries(mapeamento)) {
            if (!dbColumn.startsWith("accounts_") || !csvColumn || csvRow[csvColumn] === undefined) continue;
            
            const rawValue = csvRow[csvColumn];
            const cleanedValue = (rawValue !== null && rawValue !== undefined) ? String(rawValue).trim() : '';

            let appColumn;
            switch (dbColumn) {
                case "accounts_identity_id": 
                    identityBusinessKey = cleanedValue; // Armazena valor limpo
                    continue;
                case "accounts_resource_name": 
                    resourceNamesString = cleanedValue;
                    continue;
                case "accounts_id_in_system": appColumn = "id_in_system_account"; break;
                case "accounts_name": appColumn = "name_account"; break;
                case "accounts_email": appColumn = "email_account"; break;
                case "accounts_cpf": appColumn = "cpf_account"; break;
                case "accounts_status": appColumn = "status_account"; break;
                default: appColumn = dbColumn.replace("accounts_", "");
            }
            dataToSave[appColumn] = cleanedValue;
        }
        
        // 🚨 CRÍTICO: Validação de campos obrigatórios (Apenas ID da Conta e Email)
        if (!dataToSave['id_in_system_account'] || !dataToSave['email_account']) {
            warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - ID Único da Conta ou Email vazios. A conta não pode ser salva.`);
            continue; 
        }
        
        // --- NOVO FLUXO SIMPLIFICADO PARA VINCULAR IDENTIDADE (FK) ---
        if (identityBusinessKey) {
            const identity = await db.identitiesHR.findUnique({ 
                where: { identity_id_hr: identityBusinessKey }
            });
            
            if (identity) {
                identityId = identity.id; // Vincula a FK
            } else {
                warningsOrErrors.push(`Linha ${linhaNum}: AVISO - ID RH '${identityBusinessKey}' não encontrado. A conta será ÓRFÃ.`);
                identityId = null; // Define explicitamente como NULL para o Int? no schema
            }
        } else {
            // Chave NÃO fornecida (CONTA ÓRFÃ INTENCIONAL)
            warningsOrErrors.push(`Linha ${linhaNum}: AVISO - ID RH ausente. Conta marcada como potencial ÓRFÃ.`);
            identityId = null; // Define explicitamente como NULL para o Int? no schema
        }

        // Cria Conta
        dataToSave.systemId = systemId; 
        // 🚨 CRÍTICO: Passamos NULL, que agora é permitido pelo schema Int?
        dataToSave.identityId = identityId; 
        
        const account = await db.accounts.upsert({ 
            where: { id_in_system_account: dataToSave.id_in_system_account },
            update: dataToSave,
            create: dataToSave,
        });
        processedCount++;
        
        // Cria Atribuições
        if (resourceNamesString) {
            const resourceNamesArray = String(resourceNamesString).split(';');
            const uniqueResourceNames = [...new Set(resourceNamesArray.map(r => r.replace(/"/g, '').trim()).filter(Boolean))];

            for (const resourceName of uniqueResourceNames) {
                const resourceId = resourceCache.get(resourceName);
                if (resourceId) {
                    await db.assignment.create({ 
                        data: { accountId: account.id, resourceId: resourceId }
                    });
                } else {
                    warningsOrErrors.push(`Linha ${linhaNum}: AVISO - Recurso '${resourceName}' não encontrado.`);
                }
            }
        }
    } catch (dbError) {
        warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Erro ao salvar/processar: ${dbError.message}`);
    }
  } 

  return { processedCount, warningsOrErrors };
};

/**
 * Processa e salva dados de RECURSOS (SISTEMA)
 */
const processAndSaveData_Recursos = async (db, systemId, rows, mapeamento) => {
  let processedCount = 0;
  const warningsOrErrors = [];

  // Limpa dados antigos (OPERAÇÃO NÃO-ATÔMICA)
  await db.assignment.deleteMany({ where: { resource: { systemId: systemId } } });
  await db.resource.deleteMany({ where: { systemId: systemId } });

  for (const [index, csvRow] of rows.entries()) {
    const linhaNum = index + 2; 
    const dataToSave = {};

    try { // TRY-CATCH POR LINHA
        // Mapeamento
        for (const [dbColumn, csvColumn] of Object.entries(mapeamento)) {
            if (dbColumn.startsWith("resources_") && csvColumn && csvRow[csvColumn] !== undefined) {
                const rawValue = csvRow[csvColumn];
                const cleanedValue = (rawValue !== null && rawValue !== undefined) ? String(rawValue).trim() : '';

                let appColumn;
                switch (dbColumn) {
                    case "resources_name": appColumn = "name_resource"; break;
                    case "resources_description": appColumn = "description_resource"; break;
                    default: appColumn = dbColumn.replace("resources_", "");
                }
                dataToSave[appColumn] = cleanedValue;
            }
        }
        
        if (!dataToSave['name_resource'] || !dataToSave['permissions']) {
            warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Nome ou Permissões vazios.`);
            continue;
        }

        // Salvar (usando 'db' global)
        dataToSave.systemId = systemId; 
        await db.resource.create({ data: dataToSave });
        processedCount++;
    } catch (dbError) {
        warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Erro ao criar recurso.`);
    }
  } 

  return { processedCount, warningsOrErrors };
};

// ===========================================================================
// 3. CONTROLADORES (ROTAS) - LIMPEZA DE LÓGICA OBSOLETA
// ===========================================================================

// --- A lógica de ensureOrphanIdentityExists foi removida, pois é obsoleta ---

// GET HISTÓRICO
const getImportHistory = async (req, res) => {
  try {
    const userIdInt = parseInt(req.user.id, 10);
    const importLogs = await prisma.importLog.findMany({
      where: { userId: userIdInt }, 
      orderBy: { createdAt: "desc" },
      include: { 
        user: { select: { name: true } },
        dataSource: { select: { name_datasource: true, systemConfig: { select: { systemId: true } } } } 
      },
    });
    return res.status(200).json(importLogs);
  } catch (error) {
    return res.status(500).json({ message: "Erro interno." });
  }
};

// DELETAR LOG
const deleteImportLog = async (req, res) => {
  const logId = parseInt(req.params.id, 10);
  const userIdInt = parseInt(req.user.id, 10);
  try {
    const deleteResult = await prisma.importLog.deleteMany({ where: { id: logId, userId: userIdInt } });
    if (deleteResult.count === 0) return res.status(404).json({ message: "Log não encontrado." });
    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: "Erro interno." });
  }
};


// ROTA A: PROCESSAMENTO DE DIRETÓRIO (CSV NO SERVIDOR)
const handleDirectoryProcess = async (req, res) => {
  const user = req.user;
  const { dataSourceId, processingTarget } = req.body; 

  if (!user || !dataSourceId || !processingTarget) return res.status(400).json({ message: "Dados incompletos." });

  const dataSource = await prisma.dataSource.findFirst({
    where: { id: parseInt(dataSourceId), userId: parseInt(user.id) },
    include: { hrConfig: true, systemConfig: { include: { system: true } }, mappingRH: true, mappingSystem: true }
  });

  if (!dataSource) return res.status(404).json({ message: "Fonte não encontrada." });

  // Lógica de validação de rota (Mantida)
  let isTargetFile = dataSource.type_datasource === 'CSV'; 
  if (dataSource.origem_datasource === 'SISTEMA') {
      const config = dataSource.systemConfig;
      if (processingTarget === 'CONTAS' && config?.tipo_fonte_contas === 'CSV') isTargetFile = true;
      else if (processingTarget === 'RECURSOS' && config?.tipo_fonte_recursos === 'CSV') isTargetFile = true;
      else isTargetFile = false; 
  }
  if (!isTargetFile) {
      return res.status(400).json({ message: "A fonte selecionada está configurada como Banco de Dados/API. Use a rota de sincronização correta." });
  }

  const logTarget = dataSource.origem_datasource === 'SISTEMA' ? processingTarget : dataSource.origem_datasource;
  const importLog = await prisma.importLog.create({
    data: { fileName: "Lendo Diretório...", status: "PENDING", userId: parseInt(user.id), dataSourceId: dataSource.id, processingTarget: logTarget },
  });

  try {
    // 1. Localiza e lê o arquivo CSV
    let diretorio = null;
    if (dataSource.origem_datasource === 'RH') diretorio = dataSource.hrConfig?.diretorio_hr;
    else if (dataSource.origem_datasource === 'SISTEMA') {
        diretorio = processingTarget === 'CONTAS' ? dataSource.systemConfig?.diretorio_contas : dataSource.systemConfig?.diretorio_recursos;
    }

    if (!diretorio) throw new Error("Diretório não configurado.");

    const fullCsvPath = await findSingleCsvInDir(diretorio);
    const fileName = path.basename(fullCsvPath);
    
    await prisma.importLog.update({ where: { id: importLog.id }, data: { fileName: fileName } });

    const fileContent = await fs.promises.readFile(fullCsvPath, "utf8");
    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const rows = parsedCsv.data;

    if (!rows.length) throw new Error("O arquivo CSV está vazio.");
    
    // Validação Dinâmica de Colunas (Mantida)
    if (dataSource.origem_datasource === 'SISTEMA' && processingTarget === 'CONTAS' && rows.length > 0) {
        const requiredMappings = ['accounts_id_in_system', 'accounts_email', 'accounts_identity_id', 'accounts_resource_name'];
        const availableKeys = Object.keys(rows[0] || {});
        
        let missingSourceCol = null;
        for (const appField of requiredMappings) {
            const sourceCol = dataSource.mappingSystem?.[appField];
            if (sourceCol && !availableKeys.includes(sourceCol)) {
                missingSourceCol = { appField, sourceCol };
                break;
            }
        }

        if (missingSourceCol) {
            throw new Error(`COLUNA CRÍTICA AUSENTE: O campo obrigatório '${missingSourceCol.appField}' (mapeado para '${missingSourceCol.sourceCol}') não foi encontrado nos cabeçalhos do CSV. Verifique o mapeamento.`);
        }
    }

    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "PROCESSING", totalRows: rows.length } });

    // 2. Define qual função chamar
    let processFunction = null;
    let mapeamento = null;
    let systemId = null;
    let resourceCache = new Map();

    switch (dataSource.origem_datasource) {
        case "RH":
            mapeamento = dataSource.mappingRH;
            processFunction = (db, r) => processAndSaveData_RH(db, dataSource.id, r, mapeamento);
            break;
        case "SISTEMA":
            systemId = dataSource.systemConfig.systemId;
            mapeamento = dataSource.mappingSystem;
            if (processingTarget === "CONTAS") {
                const resources = await prisma.resource.findMany({ where: { systemId }, select: { id: true, name_resource: true } });
                resourceCache = new Map(resources.map(r => [r.name_resource.trim(), r.id]));
                processFunction = (db, r) => processAndSaveData_Contas(db, systemId, r, mapeamento, resourceCache);
            } else {
                processFunction = (db, r) => processAndSaveData_Recursos(db, systemId, r, mapeamento);
            }
            break;
    }

    // 3. Executa
    const { processedCount, warningsOrErrors } = await processFunction(prisma, rows);

    // 4. Finaliza Log
    const hasErrors = warningsOrErrors.some(msg => msg.includes("IGNORADA"));
    const finishedLog = await prisma.importLog.update({
        where: { id: importLog.id },
        data: { 
            status: hasErrors ? "FAILED" : "SUCCESS", 
            processedRows: processedCount, 
            completedAt: new Date(), 
            errorDetails: warningsOrErrors.length > 0 ? warningsOrErrors.join('\n') : null 
        }
    });
    return res.status(201).json(finishedLog);

  } catch (error) {
    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "FAILED", errorDetails: error.message, completedAt: new Date() } });
    return res.status(500).json({ message: error.message });
  }
};

// ROTA B: PROCESSAMENTO DE BANCO DE DADOS (SYNC)
const handleDatabaseSync = async (req, res) => {
  const user = req.user;
  const { dataSourceId, processingTarget } = req.body; 

  if (!user || !dataSourceId || !processingTarget) return res.status(400).json({ message: "Dados incompletos." });

  const dataSource = await prisma.dataSource.findFirst({
    where: { id: parseInt(dataSourceId), userId: parseInt(user.id) },
    include: { hrConfig: true, systemConfig: { include: { system: true } }, mappingRH: true, mappingSystem: true }
  });

  if (!dataSource) return res.status(404).json({ message: "Fonte não encontrada." });

  // Lógica de validação de rota (Mantida)
  let isTargetDatabase = dataSource.type_datasource === 'DATABASE'; 
  if (dataSource.origem_datasource === 'SISTEMA') {
      const config = dataSource.systemConfig;
      if (processingTarget === 'CONTAS' && config?.tipo_fonte_contas === 'DATABASE') isTargetDatabase = true;
      else if (processingTarget === 'RECURSOS' && config?.tipo_fonte_recursos === 'DATABASE') isTargetDatabase = true;
      else isTargetDatabase = false; 
  }
  if (!isTargetDatabase) {
      return res.status(400).json({ message: "A fonte selecionada está configurada como Arquivo/API. Use a rota de processamento de diretório." });
  }

  const logTarget = dataSource.origem_datasource === 'SISTEMA' ? processingTarget : dataSource.origem_datasource;
  const importLog = await prisma.importLog.create({
    data: { fileName: "Conectando ao Banco...", status: "PENDING", userId: parseInt(user.id), dataSourceId: dataSource.id, processingTarget: logTarget },
  });

  try {
    // 1. Conecta e busca dados
    let dbConfig = null;
    let tableName = null;

    if (dataSource.origem_datasource === 'RH') {
        dbConfig = dataSource.hrConfig;
        tableName = dbConfig.db_table;
    } else if (dataSource.origem_datasource === 'SISTEMA') {
        dbConfig = dataSource.systemConfig;
        tableName = processingTarget === 'CONTAS' ? dbConfig.diretorio_contas : dbConfig.diretorio_recursos;
    }

    if (!tableName) throw new Error("Nome da tabela não configurado.");

    await prisma.importLog.update({ where: { id: importLog.id }, data: { fileName: `Tabela: ${tableName}` } });

    const rows = await fetchDataFromDatabase(dbConfig, tableName);
    
    if (!rows.length) throw new Error("A tabela está vazia.");

    // Validação Dinâmica de Colunas (Mantida)
    if (dataSource.origem_datasource === 'SISTEMA' && processingTarget === 'CONTAS' && rows.length > 0) {
        const requiredMappings = ['accounts_id_in_system', 'accounts_email', 'accounts_identity_id', 'accounts_resource_name'];
        const availableKeys = Object.keys(rows[0] || {});
        
        let missingSourceCol = null;
        for (const appField of requiredMappings) {
            const sourceCol = dataSource.mappingSystem?.[appField];
            if (sourceCol && !availableKeys.includes(sourceCol)) {
                missingSourceCol = { appField, sourceCol };
                break;
            }
        }

        if (missingSourceCol) {
            throw new Error(`COLUNA CRÍTICA AUSENTE: O campo obrigatório '${missingSourceCol.appField}' (mapeado para '${missingSourceCol.sourceCol}') não foi encontrado na tabela do banco de dados. Verifique o mapeamento (caixa alta/baixa).`);
        }
    }


    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "PROCESSING", totalRows: rows.length } });

    // 2. Define qual função chamar
    let processFunction = null;
    let mapeamento = null;
    let systemId = null;
    let resourceCache = new Map();

    switch (dataSource.origem_datasource) {
        case "RH":
            mapeamento = dataSource.mappingRH;
            processFunction = (db, r) => processAndSaveData_RH(db, dataSource.id, r, mapeamento);
            break;
        case "SISTEMA":
            systemId = dataSource.systemConfig.systemId;
            mapeamento = dataSource.mappingSystem;
            if (processingTarget === "CONTAS") {
                const resources = await prisma.resource.findMany({ where: { systemId }, select: { id: true, name_resource: true } });
                resourceCache = new Map(resources.map(r => [r.name_resource.trim(), r.id]));
                processFunction = (db, r) => processAndSaveData_Contas(db, systemId, r, mapeamento, resourceCache);
            } else {
                processFunction = (db, r) => processAndSaveData_Recursos(db, systemId, r, mapeamento);
            }
            break;
    }

    // 3. Executa
    const { processedCount, warningsOrErrors } = await processFunction(prisma, rows);

    // 4. Finaliza Log
    const hasErrors = warningsOrErrors.some(msg => msg.includes("IGNORADA"));
    const finishedLog = await prisma.importLog.update({
        where: { id: importLog.id },
        data: { 
            status: hasErrors ? "FAILED" : "SUCCESS", 
            processedRows: processedCount, 
            completedAt: new Date(), 
            errorDetails: warningsOrErrors.length > 0 ? warningsOrErrors.join('\n') : null 
        }
    });
    return res.status(201).json(finishedLog);

  } catch (error) {
    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "FAILED", errorDetails: error.message, completedAt: new Date() } });
    return res.status(500).json({ message: error.message });
  }
};


// ROTA C: UPLOAD MANUAL (LEGADO / ARRASTAR ARQUIVO)
const handleUploadProcess = async (req, res) => {
  const user = req.user;
  const { dataSourceId, processingTarget } = req.body; 
  const file = req.file;

  if (!user || !dataSourceId || !file) return res.status(400).json({ message: "Dados incompletos." });
  
  const dataSource = await prisma.dataSource.findFirst({
    where: { id: parseInt(dataSourceId), userId: parseInt(user.id) },
    include: { hrConfig: true, systemConfig: { include: { system: true } }, mappingRH: true, mappingSystem: true }
  });
  if (!dataSource) return res.status(404).json({ message: "Fonte não encontrada." });

  const logTarget = dataSource.origem_datasource === 'SISTEMA' ? processingTarget : dataSource.origem_datasource;
  const importLog = await prisma.importLog.create({
    data: { fileName: file.originalname, status: "PENDING", userId: parseInt(user.id), dataSourceId: dataSource.id, processingTarget: logTarget },
  });

  try {
    const fileContent = file.buffer.toString("utf8");
    const parsedCsv = Papa.parse(fileContent, { header: true, skipEmptyLines: true });
    const rows = parsedCsv.data;
    
    let processFunction = null;
    let mapeamento = null;
    let systemId = null;
    let resourceCache = new Map();

    switch (dataSource.origem_datasource) {
        case "RH":
            mapeamento = dataSource.mappingRH;
            processFunction = (db, r) => processAndSaveData_RH(db, dataSource.id, r, mapeamento);
            break;
        case "SISTEMA":
            systemId = dataSource.systemConfig.systemId;
            mapeamento = dataSource.mappingSystem;
            if (processingTarget === "CONTAS") {
                const resources = await prisma.resource.findMany({ where: { systemId }, select: { id: true, name_resource: true } });
                resourceCache = new Map(resources.map(r => [r.name_resource.trim(), r.id]));
                processFunction = (db, r) => processAndSaveData_Contas(db, systemId, r, mapeamento, resourceCache);
            } else {
                processFunction = (db, r) => processAndSaveData_Recursos(db, systemId, r, mapeamento);
            }
            break;
    }

    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "PROCESSING", totalRows: rows.length } });
    
    const { processedCount, warningsOrErrors } = await processFunction(prisma, rows);

    const hasErrors = warningsOrErrors.some(msg => msg.includes("IGNORADA"));
    const finishedLog = await prisma.importLog.update({
        where: { id: importLog.id },
        data: { 
            status: hasErrors ? "FAILED" : "SUCCESS", 
            processedRows: processedCount, 
            completedAt: new Date(), 
            errorDetails: warningsOrErrors.length > 0 ? warningsOrErrors.join('\n') : null 
        }
    });
    return res.status(201).json(finishedLog);

  } catch (error) {
      await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "FAILED", errorDetails: error.message, completedAt: new Date() } });
      return res.status(500).json({ message: error.message });
  }
};


// ===========================================================================
// DEFINIÇÃO DE ROTAS
// ===========================================================================

// ... (getImportHistory e deleteImportLog permanecem inalterados) ...

router.get("/", passport.authenticate("jwt", { session: false }), getImportHistory);
router.delete("/:id", passport.authenticate("jwt", { session: false }), deleteImportLog);

// 1. Rota para DIRETÓRIO
router.post("/process-directory", passport.authenticate("jwt", { session: false }), handleDirectoryProcess);

// 2. Rota para BANCO DE DADOS
router.post("/sync-db", passport.authenticate("jwt", { session: false }), handleDatabaseSync);

// 3. Rota para UPLOAD MANUAL (LEGADO)
router.post("/upload", passport.authenticate("jwt", { session: false }), upload.single("csvFile"), handleUploadProcess);

export default router;