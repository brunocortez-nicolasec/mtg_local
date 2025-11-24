// material-react-app/src/layouts/observabilidade/mapeamentoDados/hooks/useColumnFetcher.js

import { useState, useEffect } from "react";
import axios from "axios";

// Criamos a instância, mas sem o header fixo inicial que pode estar vazio
const api = axios.create({
  baseURL: "/",
});

export function useColumnFetcher(dataSource, mappingTarget) {
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchColumns = async () => {
      // Limpa colunas se não houver fonte selecionada
      if (!dataSource) {
        setColumns([]);
        return;
      }

      setLoading(true);
      setError(null);

      // 1. Obtém o token atualizado
      const token = localStorage.getItem("token");
      if (!token) {
          setError("Usuário não autenticado. Faça login novamente.");
          setLoading(false);
          return;
      }
      
      // 2. Configura o header de autorização para esta requisição específica
      const authHeaders = { Authorization: `Bearer ${token}` };

      try {
        let fetchedCols = [];
        
        // ======================= Lógica de Tipo (Mantida) =======================
        let currentType = dataSource.type_datasource; 

        if (dataSource.origem_datasource === 'SISTEMA' && dataSource.systemConfig) {
            if (mappingTarget === 'CONTAS') {
                currentType = dataSource.systemConfig.tipo_fonte_contas;
            } else {
                currentType = dataSource.systemConfig.tipo_fonte_recursos;
            }
        } else if (dataSource.origem_datasource === 'RH' && dataSource.hrConfig) {
             // Se RH tiver config de DB, assume DATABASE
             if (dataSource.hrConfig.db_host || dataSource.hrConfig.db_url) {
                 currentType = 'DATABASE';
             }
        }

        const isDatabase = currentType === 'DATABASE';
        // ========================================================================


        // === CENÁRIO 1: BANCO DE DADOS ===
        if (isDatabase) {
           let dbConfig = {};
           let targetTable = "";

           if (dataSource.origem_datasource === 'RH') {
               dbConfig = dataSource.hrConfig;
               targetTable = dbConfig.db_table; 
           } else if (dataSource.origem_datasource === 'SISTEMA') {
               dbConfig = dataSource.systemConfig;
               if (mappingTarget === 'CONTAS') {
                   targetTable = dbConfig.diretorio_contas; 
               } else {
                   targetTable = dbConfig.diretorio_recursos;
               }
           }

           if (dbConfig && targetTable) {
               const response = await api.post("/datasources/test-db", {
                   connectionType: dbConfig.db_connection_type,
                   host: dbConfig.db_host,
                   port: dbConfig.db_port,
                   user: dbConfig.db_user,
                   password: dbConfig.db_password,
                   database: dbConfig.db_name,
                   url: dbConfig.db_url,
                   type: dbConfig.db_type,
                   schema: dbConfig.db_schema,
                   table: targetTable 
               }, { headers: authHeaders }); // <--- TOKEN ADICIONADO AQUI
               
               if (response.data.columns) {
                   fetchedCols = response.data.columns;
               } else {
                   throw new Error(`Conexão OK, mas não foi possível ler as colunas da tabela '${targetTable}'.`);
               }
           } else {
               throw new Error("Configuração de banco de dados incompleta ou tabela não definida.");
           }

        // === CENÁRIO 2: ARQUIVO CSV ===
        } else {
           let diretorio = null;
           
           if (dataSource.origem_datasource === 'RH') {
               diretorio = dataSource.hrConfig?.diretorio_hr;
           } else if (dataSource.origem_datasource === 'SISTEMA') {
               if (mappingTarget === 'CONTAS') {
                   diretorio = dataSource.systemConfig?.diretorio_contas;
               } else {
                   diretorio = dataSource.systemConfig?.diretorio_recursos;
               }
           }

           if (diretorio) {
               // Passando o header com token
               const response = await api.post("/datasources/test-csv", { diretorio }, { headers: authHeaders });
               if (response.data.header) {
                   fetchedCols = response.data.header.split(',');
               } else {
                   throw new Error("O arquivo CSV parece estar vazio ou sem cabeçalho.");
               }
           } else {
               if (currentType === 'API') {
                   fetchedCols = ["Mapeamento Automático (API)"];
               } else {
                   throw new Error(`Caminho do arquivo/tabela não encontrado na configuração (${currentType}).`);
               }
           }
        }

        setColumns(fetchedCols);

      } catch (err) {
        console.error("Erro ao buscar colunas:", err);
        // Tratamento específico para 401
        if (err.response && err.response.status === 401) {
            setError("Sessão expirada. Por favor, recarregue a página.");
        } else {
            const msg = err.response?.data?.message || err.message || "Erro ao buscar colunas.";
            setError(msg);
        }
        setColumns([]);
      } finally {
        setLoading(false);
      }
    };

    fetchColumns();
  }, [dataSource, mappingTarget]); 

  return { columns, loading, error };
}