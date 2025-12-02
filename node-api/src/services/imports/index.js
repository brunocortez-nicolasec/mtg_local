// node-api/src/services/imports/index.js
import express from "express";
import passport from "passport";
import multer from "multer";
import { PrismaClient } from '@prisma/client';
import Papa from "papaparse";
import fs from 'fs';
import path from 'path';
import pkg from 'pg';
import oracledb from 'oracledb';
import axios from 'axios';
import { parseStringPromise } from 'xml2js';

const { Client } = pkg;

// Configuração Global do Oracle: Retornar resultados como Objetos, não Arrays
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ===========================================================================
// 1. HELPERS DE LEITURA (ARQUIVO, BANCO E API)
// ===========================================================================

const findSingleCsvInDir = async (directoryPath) => {
  const basePath = process.cwd();
  const cleanPath = directoryPath.replace(/["']/g, "").trim().replace(/^[\.\/]+/, "");
  const absolutePath = path.join(basePath, cleanPath);

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

// --- HELPER DE BANCO DE DADOS (HÍBRIDO: POSTGRES + ORACLE) ---
const fetchDataFromDatabase = async (dbConfig, tableName) => {
    if (!dbConfig) throw new Error("Configuração de banco de dados ausente.");
    if (!tableName) throw new Error("Nome da tabela não especificado.");

    // Detecta o tipo (se não tiver definido, assume postgres por legado)
    const dbType = dbConfig.db_type ? dbConfig.db_type.toLowerCase() : 'postgres';

    // =========================================================
    // LÓGICA ORACLE
    // =========================================================
    if (dbType === 'oracle') {
        let connection;
        try {
            let connectString;
            
            // 1. Monta a string de conexão (Easy Connect)
            if (dbConfig.db_connection_type === 'URL') {
                if (!dbConfig.db_url) throw new Error("URL de conexão Oracle ausente.");
                connectString = dbConfig.db_url;
            } else {
                if (!dbConfig.db_host || !dbConfig.db_name) throw new Error("Host ou Service Name Oracle ausentes.");
                const port = dbConfig.db_port || 1521;
                connectString = `${dbConfig.db_host}:${port}/${dbConfig.db_name}`;
            }

            // 2. Conecta
            connection = await oracledb.getConnection({
                user: dbConfig.db_user,
                password: dbConfig.db_password,
                connectString: connectString
            });

            // 3. Monta a Query 
            let fullTableName = tableName;
            if (dbConfig.db_schema && dbConfig.db_schema.trim() !== '' && dbConfig.db_schema !== 'public') {
                fullTableName = `${dbConfig.db_schema}.${tableName}`;
            }

            const query = `SELECT * FROM ${fullTableName}`;
            
            // Executa
            const result = await connection.execute(query);
            await connection.close();

            // Retorna as linhas
            return result.rows;

        } catch (error) {
            if (connection) {
                try { await connection.close(); } catch(e) {}
            }
            throw new Error(`Erro Oracle: ${error.message}`);
        }
    }

    // =========================================================
    // LÓGICA POSTGRESQL (Padrão)
    // =========================================================
    else {
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
            
            return res.rows; 
        } catch (error) {
            try { await client.end(); } catch(e) {}
            throw new Error(`Erro Postgres: ${error.message}`);
        }
    }
};

// --- HELPER DE API (REST / SOAP) ---
const fetchDataFromApi = async (config) => {
    const { api_url, api_method, api_headers, api_body, api_response_path } = config;

    if (!api_url) throw new Error("URL da API não configurada.");

    // Prepara Headers (vem do banco como JSON Object)
    const headers = api_headers || {};
    
    const reqConfig = {
        method: api_method || 'GET',
        url: api_url,
        headers: headers,
        timeout: 30000 // 30s timeout para sync
    };

    if (api_body) reqConfig.data = api_body;

    try {
        const response = await axios(reqConfig);
        let finalData = response.data;

        // Conversão XML/SOAP se necessário
        const contentType = response.headers['content-type'] || '';
        const isXml = contentType.includes('xml') || (typeof response.data === 'string' && response.data.trim().startsWith('<'));

        if (isXml) {
            try {
                finalData = await parseStringPromise(response.data, { explicitArray: false, ignoreAttrs: true });
            } catch (e) {
                throw new Error("Falha ao converter resposta XML/SOAP.");
            }
        }

        // Navegação pelo Response Path (ex: data.users)
        if (api_response_path) {
            const pathParts = api_response_path.split('.');
            let current = finalData;
            for (const part of pathParts) {
                if (current && current[part] !== undefined) {
                    current = current[part];
                } else {
                    current = null;
                    break;
                }
            }
            finalData = current;
        }

        // Normalização para Array
        let dataArray = [];
        if (Array.isArray(finalData)) {
            dataArray = finalData;
        } else if (typeof finalData === 'object' && finalData !== null) {
            // Tenta achar array dentro do objeto automaticamente se não tiver path
            const arrayKey = Object.keys(finalData).find(key => Array.isArray(finalData[key]));
            if (arrayKey) {
                dataArray = finalData[arrayKey];
            } else {
                // Se for objeto único, transforma em array de 1 item
                dataArray = [finalData];
            }
        } else {
            throw new Error("A resposta da API não contém uma lista de dados válida.");
        }

        return dataArray;

    } catch (error) {
        const msg = error.response ? `Status ${error.response.status}: ${JSON.stringify(error.response.data)}` : error.message;
        throw new Error(`Erro na API: ${msg}`);
    }
};

// ===========================================================================
// 2. LÓGICAS DE PROCESSAMENTO (CORE)
// ===========================================================================

const processAndSaveData_RH = async (db, dataSourceId, rows, mapeamento) => {
  let processedCount = 0;
  const warningsOrErrors = [];

  await db.identitiesHR.deleteMany({ where: { dataSourceId: dataSourceId } });

  for (const [index, csvRow] of rows.entries()) {
    const linhaNum = index + 2; 
    const dataToSave = {};

    try { 
        for (const [appColumn, csvColumn] of Object.entries(mapeamento)) {
            if (appColumn === "id" || appColumn === "dataSourceId") continue;
            
            if (csvColumn) {
                let rawValue = csvRow[csvColumn];
                // Fallback UpperCase (Oracle/API)
                if (rawValue === undefined) {
                     rawValue = csvRow[csvColumn.toUpperCase()];
                }

                if (rawValue !== undefined) {
                    dataToSave[appColumn] = (rawValue !== null) 
                                            ? String(rawValue).trim() 
                                            : '';
                }
            }
        }
        
        const requiredFields = ['identity_id_hr', 'email_hr', 'status_hr'];
        const missingFields = [];
        for (const field of requiredFields) {
            if (!dataToSave[field]) missingFields.push(field);
        }

        if (missingFields.length > 0) {
            warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Campos obrigatórios vazios: [${missingFields.join(', ')}].`);
            continue; 
        }

        dataToSave.dataSourceId = dataSourceId; 
        await db.identitiesHR.create({ data: dataToSave });
        processedCount++;
    } catch (dbError) {
        warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Erro fatal no banco: ${dbError.message}`);
    }
  }

  return { processedCount, warningsOrErrors };
};

const processAndSaveData_Contas = async (db, systemId, rows, mapeamento, resourceCache) => {
  let processedCount = 0;
  const warningsOrErrors = [];
  
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

    try { 
        for (const [dbColumn, csvColumn] of Object.entries(mapeamento)) {
            if (!dbColumn.startsWith("accounts_") || !csvColumn) continue;
            
            let rawValue = csvRow[csvColumn];
            // Fallback UpperCase (Oracle/API)
            if (rawValue === undefined) {
                rawValue = csvRow[csvColumn.toUpperCase()];
            }

            if (rawValue === undefined) continue;

            const cleanedValue = (rawValue !== null) ? String(rawValue).trim() : '';

            let appColumn;
            switch (dbColumn) {
                case "accounts_identity_id": 
                    identityBusinessKey = cleanedValue; 
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
        
        if (!dataToSave['id_in_system_account'] || !dataToSave['email_account']) {
            warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - ID Único da Conta ou Email vazios.`);
            continue; 
        }
        
        if (identityBusinessKey) {
            const identity = await db.identitiesHR.findUnique({ 
                where: { identity_id_hr: identityBusinessKey }
            });
            
            if (identity) {
                identityId = identity.id; 
            } else {
                warningsOrErrors.push(`Linha ${linhaNum}: AVISO - ID RH '${identityBusinessKey}' não encontrado. Conta ÓRFÃ.`);
                identityId = null; 
            }
        } else {
            warningsOrErrors.push(`Linha ${linhaNum}: AVISO - ID RH ausente. Conta ÓRFÃ.`);
            identityId = null; 
        }

        dataToSave.systemId = systemId; 
        dataToSave.identityId = identityId; 
        
        const account = await db.accounts.upsert({ 
            where: { id_in_system_account: dataToSave.id_in_system_account },
            update: dataToSave,
            create: dataToSave,
        });
        processedCount++;
        
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
        warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Erro ao salvar: ${dbError.message}`);
    }
  } 

  return { processedCount, warningsOrErrors };
};

const processAndSaveData_Recursos = async (db, systemId, rows, mapeamento) => {
  let processedCount = 0;
  const warningsOrErrors = [];

  await db.assignment.deleteMany({ where: { resource: { systemId: systemId } } });
  await db.resource.deleteMany({ where: { systemId: systemId } });

  for (const [index, csvRow] of rows.entries()) {
    const linhaNum = index + 2; 
    const dataToSave = {};

    try { 
        for (const [dbColumn, csvColumn] of Object.entries(mapeamento)) {
            if (dbColumn.startsWith("resources_") && csvColumn) {
                
                let rawValue = csvRow[csvColumn];
                // Fallback UpperCase (Oracle/API)
                if (rawValue === undefined) {
                    rawValue = csvRow[csvColumn.toUpperCase()];
                }

                if (rawValue !== undefined) {
                    const cleanedValue = (rawValue !== null) ? String(rawValue).trim() : '';

                    let appColumn;
                    switch (dbColumn) {
                        case "resources_name": appColumn = "name_resource"; break;
                        case "resources_description": appColumn = "description_resource"; break;
                        default: appColumn = dbColumn.replace("resources_", "");
                    }
                    dataToSave[appColumn] = cleanedValue;
                }
            }
        }
        
        if (!dataToSave['name_resource'] || !dataToSave['permissions']) {
            warningsOrErrors.push(`Linha ${linhaNum}: IGNORADA - Nome ou Permissões vazios.`);
            continue;
        }

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
// 3. CONTROLADORES (ROTAS)
// ===========================================================================

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

  let isTargetFile = dataSource.type_datasource === 'CSV'; 
  if (dataSource.origem_datasource === 'SISTEMA') {
      const config = dataSource.systemConfig;
      if (processingTarget === 'CONTAS' && config?.tipo_fonte_contas === 'CSV') isTargetFile = true;
      else if (processingTarget === 'RECURSOS' && config?.tipo_fonte_recursos === 'CSV') isTargetFile = true;
      else isTargetFile = false; 
  }
  if (!isTargetFile) {
      return res.status(400).json({ message: "A fonte selecionada está configurada como Banco de Dados/API." });
  }

  const logTarget = dataSource.origem_datasource === 'SISTEMA' ? processingTarget : dataSource.origem_datasource;
  const importLog = await prisma.importLog.create({
    data: { fileName: "Lendo Diretório...", status: "PENDING", userId: parseInt(user.id), dataSourceId: dataSource.id, processingTarget: logTarget },
  });

  try {
    let diretorio = null;
    let delimiter = ",";
    let quote = '"';

    if (dataSource.origem_datasource === 'RH') {
        diretorio = dataSource.hrConfig?.diretorio_hr;
        delimiter = dataSource.hrConfig?.csv_delimiter || ",";
        quote = dataSource.hrConfig?.csv_quote || '"';
    } else if (dataSource.origem_datasource === 'SISTEMA') {
        const sysConfig = dataSource.systemConfig;
        diretorio = processingTarget === 'CONTAS' ? sysConfig?.diretorio_contas : sysConfig?.diretorio_recursos;
        delimiter = sysConfig?.csv_delimiter || ",";
        quote = sysConfig?.csv_quote || '"';
    }

    if (!diretorio) throw new Error("Diretório não configurado.");

    const fullCsvPath = await findSingleCsvInDir(diretorio);
    const fileName = path.basename(fullCsvPath);
    
    await prisma.importLog.update({ where: { id: importLog.id }, data: { fileName: fileName } });

    const fileContent = await fs.promises.readFile(fullCsvPath, "utf8");
    
    const parsedCsv = Papa.parse(fileContent, { 
        header: true, 
        skipEmptyLines: true,
        delimiter: delimiter,
        quoteChar: quote
    });
    const rows = parsedCsv.data;

    if (!rows.length) throw new Error("O arquivo CSV está vazio ou não pôde ser lido com o delimitador configurado.");
    
    // Validação Dinâmica de Colunas (CSV)
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
            throw new Error(`COLUNA CRÍTICA AUSENTE: O campo obrigatório '${missingSourceCol.appField}' (mapeado para '${missingSourceCol.sourceCol}') não foi encontrado. Verifique se o Delimitador CSV está correto.`);
        }
    }

    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "PROCESSING", totalRows: rows.length } });

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

  let isTargetDatabase = dataSource.type_datasource === 'DATABASE'; 
  if (dataSource.origem_datasource === 'SISTEMA') {
      const config = dataSource.systemConfig;
      if (processingTarget === 'CONTAS' && config?.tipo_fonte_contas === 'DATABASE') isTargetDatabase = true;
      else if (processingTarget === 'RECURSOS' && config?.tipo_fonte_recursos === 'DATABASE') isTargetDatabase = true;
      else isTargetDatabase = false; 
  }
  if (!isTargetDatabase) {
      return res.status(400).json({ message: "A fonte selecionada está configurada como Arquivo/API." });
  }

  const logTarget = dataSource.origem_datasource === 'SISTEMA' ? processingTarget : dataSource.origem_datasource;
  const importLog = await prisma.importLog.create({
    data: { fileName: "Conectando ao Banco...", status: "PENDING", userId: parseInt(user.id), dataSourceId: dataSource.id, processingTarget: logTarget },
  });

  try {
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

    // --- AQUI ACONTECE A MÁGICA HÍBRIDA (Oracle/Postgres) ---
    const rows = await fetchDataFromDatabase(dbConfig, tableName);
    
    if (!rows.length) throw new Error("A tabela está vazia.");

    // Validação Dinâmica de Colunas (Para Banco)
    if (dataSource.origem_datasource === 'SISTEMA' && processingTarget === 'CONTAS' && rows.length > 0) {
        const requiredMappings = ['accounts_id_in_system', 'accounts_email', 'accounts_identity_id', 'accounts_resource_name'];
        const availableKeys = Object.keys(rows[0] || {});
        
        let missingSourceCol = null;
        for (const appField of requiredMappings) {
            const sourceCol = dataSource.mappingSystem?.[appField];
            
            // Check robusto: Verifica exato OU UpperCase (Oracle)
            if (sourceCol) {
                const exists = availableKeys.includes(sourceCol) || availableKeys.includes(sourceCol.toUpperCase());
                if (!exists) {
                    missingSourceCol = { appField, sourceCol };
                    break;
                }
            }
        }

        if (missingSourceCol) {
            throw new Error(`COLUNA CRÍTICA AUSENTE: O campo obrigatório '${missingSourceCol.appField}' (mapeado para '${missingSourceCol.sourceCol}') não foi encontrado na tabela.`);
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

// --- NOVO: ROTA DE PROCESSAMENTO DE API (SYNC) ---
const handleApiSync = async (req, res) => {
  const user = req.user;
  const { dataSourceId, processingTarget } = req.body; 

  if (!user || !dataSourceId || !processingTarget) return res.status(400).json({ message: "Dados incompletos." });

  const dataSource = await prisma.dataSource.findFirst({
    where: { id: parseInt(dataSourceId), userId: parseInt(user.id) },
    include: { hrConfig: true, systemConfig: { include: { system: true } }, mappingRH: true, mappingSystem: true }
  });

  if (!dataSource) return res.status(404).json({ message: "Fonte não encontrada." });

  let isTargetApi = dataSource.type_datasource === 'API'; 
  if (dataSource.origem_datasource === 'SISTEMA') {
      const config = dataSource.systemConfig;
      if (processingTarget === 'CONTAS' && config?.tipo_fonte_contas === 'API') isTargetApi = true;
      else if (processingTarget === 'RECURSOS' && config?.tipo_fonte_recursos === 'API') isTargetApi = true;
      else isTargetApi = false; 
  }
  if (!isTargetApi) return res.status(400).json({ message: "A fonte selecionada não é do tipo API." });

  const logTarget = dataSource.origem_datasource === 'SISTEMA' ? processingTarget : dataSource.origem_datasource;
  const importLog = await prisma.importLog.create({
    data: { fileName: "Conectando API...", status: "PENDING", userId: parseInt(user.id), dataSourceId: dataSource.id, processingTarget: logTarget },
  });

  try {
    let apiConfig = {};
    
    // Monta a config para o Helper
    if (dataSource.origem_datasource === 'RH') {
        const c = dataSource.hrConfig;
        apiConfig = {
            api_url: c.api_url,
            api_method: c.api_method,
            api_headers: c.api_headers,
            api_body: c.api_body,
            api_response_path: c.api_response_path
        };
    } else {
        const c = dataSource.systemConfig;
        // Para sistemas, a URL específica está nos campos "diretorio_*" (convenção do modal)
        const specificUrl = processingTarget === 'CONTAS' ? c.diretorio_contas : c.diretorio_recursos;
        
        apiConfig = {
            api_url: specificUrl,
            api_method: c.api_method,
            api_headers: c.api_headers,
            api_body: c.api_body,
            api_response_path: c.api_response_path
        };
    }

    await prisma.importLog.update({ where: { id: importLog.id }, data: { fileName: `API: ${apiConfig.api_url}` } });

    // Busca dados via Axios/XML2JS
    const rows = await fetchDataFromApi(apiConfig);
    
    if (!rows.length) throw new Error("A API retornou uma lista vazia.");
    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "PROCESSING", totalRows: rows.length } });

    // Processamento igual ao DB/CSV
    let processFunction, mapeamento, systemId, resourceCache = new Map();
    if(dataSource.origem_datasource === 'RH') {
        mapeamento = dataSource.mappingRH;
        processFunction = (db, r) => processAndSaveData_RH(db, dataSource.id, r, mapeamento);
    } else {
        systemId = dataSource.systemConfig.systemId;
        mapeamento = dataSource.mappingSystem;
        if(processingTarget === "CONTAS") {
            const res = await prisma.resource.findMany({ where: { systemId }, select: { id: true, name_resource: true } });
            resourceCache = new Map(res.map(r => [r.name_resource.trim(), r.id]));
            processFunction = (db, r) => processAndSaveData_Contas(db, systemId, r, mapeamento, resourceCache);
        } else {
            processFunction = (db, r) => processAndSaveData_Recursos(db, systemId, r, mapeamento);
        }
    }

    const { processedCount, warningsOrErrors } = await processFunction(prisma, rows);
    const hasErrors = warningsOrErrors.some(msg => msg.includes("IGNORADA"));
    await prisma.importLog.update({
        where: { id: importLog.id },
        data: { status: hasErrors ? "FAILED" : "SUCCESS", processedRows: processedCount, completedAt: new Date(), errorDetails: warningsOrErrors.join('\n') }
    });
    return res.status(201).json({ processedCount });

  } catch (error) {
    await prisma.importLog.update({ where: { id: importLog.id }, data: { status: "FAILED", errorDetails: error.message, completedAt: new Date() } });
    return res.status(500).json({ message: error.message });
  }
};

// ROTA C: UPLOAD MANUAL (LEGADO)
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
    
    // Busca config de delimitador (se disponível)
    let delimiter = ",";
    let quote = '"';
    if (dataSource.origem_datasource === 'RH') {
         delimiter = dataSource.hrConfig?.csv_delimiter || ",";
         quote = dataSource.hrConfig?.csv_quote || '"';
    } else if (dataSource.origem_datasource === 'SISTEMA') {
         delimiter = dataSource.systemConfig?.csv_delimiter || ",";
         quote = dataSource.systemConfig?.csv_quote || '"';
    }

    const parsedCsv = Papa.parse(fileContent, { 
        header: true, 
        skipEmptyLines: true,
        delimiter: delimiter,
        quoteChar: quote
    });
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

router.get("/", passport.authenticate("jwt", { session: false }), getImportHistory);
router.delete("/:id", passport.authenticate("jwt", { session: false }), deleteImportLog);

router.post("/process-directory", passport.authenticate("jwt", { session: false }), handleDirectoryProcess);
router.post("/sync-db", passport.authenticate("jwt", { session: false }), handleDatabaseSync);
router.post("/sync-api", passport.authenticate("jwt", { session: false }), handleApiSync); // Rota API
router.post("/upload", passport.authenticate("jwt", { session: false }), upload.single("csvFile"), handleUploadProcess);

export default router;