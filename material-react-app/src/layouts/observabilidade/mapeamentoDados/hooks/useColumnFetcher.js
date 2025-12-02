// material-react-app/src/layouts/observabilidade/mapeamentoDados/hooks/useColumnFetcher.js

import { useState, useEffect } from "react";
import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

const api = axios.create({
  baseURL: API_URL, 
});

export function useColumnFetcher(dataSource, mappingTarget) {
  const [columns, setColumns] = useState([]); 
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchColumns = async () => {
      if (!dataSource) {
        setColumns([]);
        return;
      }

      setLoading(true);
      setError(null);

      const token = localStorage.getItem("token");
      if (!token) {
          setError("Usuário não autenticado. Faça login novamente.");
          setLoading(false);
          return;
      }
      
      const authHeaders = { Authorization: `Bearer ${token}` };

      try {
        let fetchedCols = [];
        
        // ======================= Lógica de Tipo =======================
        let currentType = dataSource.type_datasource; 

        if (dataSource.origem_datasource === 'SISTEMA' && dataSource.systemConfig) {
            if (mappingTarget === 'CONTAS') {
                currentType = dataSource.systemConfig.tipo_fonte_contas;
            } else {
                currentType = dataSource.systemConfig.tipo_fonte_recursos;
            }
        } else if (dataSource.origem_datasource === 'RH' && dataSource.hrConfig) {
             if (dataSource.hrConfig.db_host || dataSource.hrConfig.db_url) {
                 currentType = 'DATABASE';
             }
             // Se tiver api_url, é API
             if (dataSource.hrConfig.api_url) {
                 currentType = 'API';
             }
        }

        const isDatabase = currentType === 'DATABASE';
        const isApi = currentType === 'API';
        // ==============================================================

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
               }, { headers: authHeaders }); 
               
               if (response.data.columns && Array.isArray(response.data.columns)) {
                   fetchedCols = response.data.columns;
               } else {
                   fetchedCols = [];
               }
           } else {
               throw new Error("Configuração de banco de dados incompleta ou tabela não definida.");
           }

        // === CENÁRIO 2: API (REST/SOAP) - NOVO ===
        } else if (isApi) {
            let apiConfig = {};
            let endpointUrl = "";

            if (dataSource.origem_datasource === 'RH') {
                const c = dataSource.hrConfig;
                apiConfig = c;
                endpointUrl = c.api_url;
            } else if (dataSource.origem_datasource === 'SISTEMA') {
                const c = dataSource.systemConfig;
                apiConfig = c;
                // Em Sistemas, a URL específica fica no campo 'diretorio_*'
                endpointUrl = mappingTarget === 'CONTAS' ? c.diretorio_contas : c.diretorio_recursos;
            }

            if (!endpointUrl) throw new Error("URL da API não configurada.");

            const response = await api.post("/datasources/test-api", {
                apiUrl: endpointUrl,
                method: apiConfig.api_method,
                headers: apiConfig.api_headers, // O backend espera o JSON Object aqui
                body: apiConfig.api_body,
                responsePath: apiConfig.api_response_path
            }, { headers: authHeaders });

            if (response.data.detectedColumns && Array.isArray(response.data.detectedColumns)) {
                fetchedCols = response.data.detectedColumns;
            } else {
                fetchedCols = []; // API conectou mas não achou array
            }

        // === CENÁRIO 3: ARQUIVO CSV ===
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
               // Busca configs de CSV se existirem
               const csvDelim = (dataSource.hrConfig || dataSource.systemConfig)?.csv_delimiter || ",";
               const csvQt = (dataSource.hrConfig || dataSource.systemConfig)?.csv_quote || '"';

               const response = await api.post("/datasources/test-csv", { 
                   diretorio,
                   delimiter: csvDelim,
                   quote: csvQt
               }, { headers: authHeaders });
               
               if (response.data.header && typeof response.data.header === 'string') {
                   fetchedCols = response.data.header.split(csvDelim).map(c => c.replace(new RegExp(csvQt, 'g'), '').trim());
               } else {
                   throw new Error("O arquivo CSV parece estar vazio ou sem cabeçalho.");
               }
           } else {
               throw new Error(`Caminho do arquivo não encontrado na configuração.`);
           }
        }

        setColumns(fetchedCols);

      } catch (err) {
        console.error("Erro ao buscar colunas:", err);
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