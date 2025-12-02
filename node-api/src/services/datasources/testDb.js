// node-api/src/services/datasources/testDb.js

import pkg from 'pg';
import oracledb from 'oracledb'; // Nova dependência

const { Client } = pkg;

// Configura o Oracle para modo Thin (padrão na v6) e formato de saída
oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

export const testDbConnection = async (req, res) => {
  const { 
    connectionType, 
    host, port, user, password, database, 
    url, 
    schema, table, 
    type // 'postgres' ou 'oracle'
  } = req.body;

  // Normaliza o tipo para lower case para facilitar comparações
  const dbType = type ? type.toLowerCase() : 'postgres';

  // Validação Inicial de Tipos Suportados
  if (dbType !== 'postgres' && dbType !== 'postgresql' && dbType !== 'oracle') {
     return res.status(400).json({ message: "Tipo de banco de dados não suportado. Use 'postgres' ou 'oracle'." });
  }

  // =================================================================
  // LÓGICA ORACLE
  // =================================================================
  if (dbType === 'oracle') {
    let connection;
    try {
      let connectString;

      if (connectionType === 'URL') {
        if (!url) return res.status(400).json({ message: "A String de Conexão é obrigatória." });
        connectString = url;
      } else {
        if (!host || !port || !user || !database) {
          return res.status(400).json({ message: "Dados de conexão (Host, Porta, Usuário, Service Name) incompletos." });
        }
        // Formato Easy Connect: host:port/service_name
        connectString = `${host}:${port}/${database}`;
      }

      // 1. Tenta Conectar
      connection = await oracledb.getConnection({
        user,
        password,
        connectString
      });

      let foundColumns = [];

      // 2. Validação de Tabela e Busca de Colunas
      if (table) {
        // No Oracle, padrão é UpperCase. Se schema não for passado, usa o User.
        const targetSchema = schema ? schema.toUpperCase() : user.toUpperCase();
        const targetTable = table.toUpperCase();

        // Query 1: Verifica existência da tabela
        const checkTableQuery = `
          SELECT 1 
          FROM all_tables 
          WHERE owner = :owner 
          AND table_name = :tbl
        `;
        
        const tableCheck = await connection.execute(checkTableQuery, [targetSchema, targetTable]);

        if (tableCheck.rows.length === 0) {
          await connection.close();
          return res.status(404).json({ 
            message: `Conexão Oracle OK, mas a tabela "${targetSchema}"."${targetTable}" não foi encontrada.` 
          });
        }

        // Query 2: Busca as colunas
        const columnsQuery = `
          SELECT column_name 
          FROM all_tab_columns 
          WHERE owner = :owner 
          AND table_name = :tbl
          ORDER BY column_id
        `;

        const columnsResult = await connection.execute(columnsQuery, [targetSchema, targetTable]);
        foundColumns = columnsResult.rows.map(row => row.COLUMN_NAME);
      }

      // 3. Sucesso
      const result = await connection.execute("SELECT SYSTIMESTAMP as NOW FROM DUAL");
      const serverTime = result.rows[0].NOW;

      await connection.close();

      return res.status(200).json({ 
        message: table 
          ? `Sucesso! Tabela Oracle encontrada com ${foundColumns.length} colunas.` 
          : "Conexão Oracle estabelecida com sucesso!", 
        serverTime: serverTime,
        columns: foundColumns
      });

    } catch (error) {
      console.error("Erro no teste de conexão Oracle:", error);
      if (connection) {
        try { await connection.close(); } catch (e) {}
      }
      return res.status(500).json({ 
        message: `Falha ao conectar Oracle: ${error.message}` 
      });
    }
  }

  // =================================================================
  // LÓGICA POSTGRESQL (Mantida Original)
  // =================================================================
  else {
    let clientConfig = {};

    if (connectionType === 'URL') {
      if (!url) return res.status(400).json({ message: "A URL de conexão é obrigatória." });
      clientConfig = { 
        connectionString: url, 
        connectionTimeoutMillis: 5000 
      };
    } else {
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

    const client = new Client(clientConfig);

    try {
      await client.connect();

      let foundColumns = [];

      if (table) {
        const targetSchema = schema || 'public';
        
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

        const columnsQuery = `
          SELECT column_name, data_type 
          FROM information_schema.columns 
          WHERE table_schema = $1 
          AND table_name = $2
        `;

        const columnsResult = await client.query(columnsQuery, [targetSchema, table]);
        foundColumns = columnsResult.rows.map(row => row.column_name);
      }

      const result = await client.query('SELECT NOW() as now');
      
      await client.end();

      return res.status(200).json({ 
        message: table 
          ? `Sucesso! Tabela encontrada com ${foundColumns.length} colunas.` 
          : "Conexão estabelecida com sucesso!", 
        serverTime: result.rows[0].now,
        columns: foundColumns 
      });

    } catch (error) {
      console.error("Erro no teste de conexão DB:", error);
      try { await client.end(); } catch (e) {} 
      
      return res.status(500).json({ 
        message: `Falha ao conectar: ${error.message}` 
      });
    }
  }
};