// node-api/src/services/datasources/testDb.js

import pkg from 'pg';
const { Client } = pkg;

export const testDbConnection = async (req, res) => {
  // Recebe os parâmetros novos (connectionType, url, schema, table)
  const { 
    connectionType, // 'HOST' ou 'URL'
    host, port, user, password, database, // Se HOST
    url, // Se URL
    schema, table, // Para validação da tabela
    type // Tipo do banco (postgres)
  } = req.body;

  // Validação do Tipo de Banco
  if (type && type !== 'postgres' && type !== 'PostgreSQL') {
     return res.status(400).json({ message: "No momento, apenas conexões PostgreSQL são suportadas para teste." });
  }

  let clientConfig = {};

  // 1. Configura o Cliente (Host vs URL)
  if (connectionType === 'URL') {
    if (!url) return res.status(400).json({ message: "A URL de conexão é obrigatória." });
    
    clientConfig = { 
      connectionString: url, 
      connectionTimeoutMillis: 5000 // Timeout de 5s
    };
  } else {
    // Validação Host
    if (!host || !port || !user || !database) {
      return res.status(400).json({ message: "Dados de conexão (Host, Porta, Usuário, Banco) incompletos." });
    }
    
    clientConfig = {
      host,
      port: parseInt(port, 10),
      user,
      password,
      database,
      connectionTimeoutMillis: 5000,
    };
  }

  // Adiciona SSL se necessário (Descomente se for usar Azure/AWS que exige SSL)
  // clientConfig.ssl = { rejectUnauthorized: false };

  const client = new Client(clientConfig);

  try {
    await client.connect();

    let foundColumns = [];

    // 2. Se o usuário informou Tabela, vamos validar e buscar colunas
    if (table) {
      const targetSchema = schema || 'public'; // Default para public se vazio
      
      // Query 1: Verifica existência da tabela
      const checkTableQuery = `
        SELECT 1 
        FROM information_schema.tables 
        WHERE table_schema = $1 
        AND table_name = $2
      `;
      
      const tableCheck = await client.query(checkTableQuery, [targetSchema, table]);

      if (tableCheck.rowCount === 0) {
        await client.end();
        return res.status(404).json({ 
          message: `Conexão OK, mas a tabela "${targetSchema}"."${table}" não foi encontrada.` 
        });
      }

      // Query 2: Busca as colunas (Describe)
      const columnsQuery = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = $1 
        AND table_name = $2
      `;

      const columnsResult = await client.query(columnsQuery, [targetSchema, table]);
      foundColumns = columnsResult.rows.map(row => row.column_name);
    }

    // 3. Se chegou aqui, sucesso total
    const result = await client.query('SELECT NOW() as now');
    
    await client.end();

    return res.status(200).json({ 
      message: table 
        ? `Sucesso! Tabela encontrada com ${foundColumns.length} colunas.` 
        : "Conexão estabelecida com sucesso!", 
      serverTime: result.rows[0].now,
      columns: foundColumns // Retorna a lista de colunas para o frontend
    });

  } catch (error) {
    console.error("Erro no teste de conexão DB:", error);
    try { await client.end(); } catch (e) {} // Tenta fechar se ficou aberta
    
    return res.status(500).json({ 
      message: `Falha ao conectar: ${error.message}` 
    });
  }
};