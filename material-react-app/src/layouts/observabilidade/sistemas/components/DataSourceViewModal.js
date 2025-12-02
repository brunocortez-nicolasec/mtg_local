// material-react-app/src/layouts/observabilidade/sistemas/components/DataSourceViewModal.js

import React from "react";
import PropTypes from "prop-types";
import { useTheme } from "@mui/material/styles";

// @mui material components
import Modal from "@mui/material/Modal";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Divider from "@mui/material/Divider";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDBadge from "components/MDBadge";

// Componente Helper
function DetailItem({ icon, label, value, darkMode, children }) {
  const valueColor = darkMode ? "white" : "text.secondary";

  return (
    <MDBox display="flex" alignItems="center" mb={1.5} lineHeight={1}>
      <Icon color="secondary" fontSize="small" sx={{ mr: 1.5 }}>
        {icon}
      </Icon>
      <MDTypography variant="button" fontWeight="bold" color="text">
        {label}:&nbsp;
      </MDTypography>

      {value ? (
        <MDTypography variant="button" fontWeight="regular" color={valueColor} sx={{ wordBreak: "break-all" }}>
          {value}
        </MDTypography>
      ) : (
        !children && (
          <MDTypography variant="button" fontWeight="regular" fontStyle="italic" color={valueColor}>
            N/A
          </MDTypography>
        )
      )}
      {children}
    </MDBox>
  );
}

DetailItem.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.any,
  darkMode: PropTypes.bool,
  children: PropTypes.node,
};

function DataSourceViewModal({ open, onClose, dataSource, darkMode }) {
  const theme = useTheme();

  if (!dataSource) return null;

  // --- 1. Lógica de Conexão Detalhada ---
  let connectionDetails = {};
  
  const iconMap = {
    // Diretórios
    "Diretório (Servidor)": "folder_open",
    "Diretório Contas": "folder_shared",
    "Diretório Recursos": "folder_special",
    "Tabela Contas": "table_view",
    "Tabela Recursos": "table_view",
    "Tabela RH": "table_view",
    // API
    "API URL": "link",
    "API User": "person",
    "Endpoint": "link",
    "Endpoint Contas": "link",
    "Endpoint Recursos": "link",
    "Método": "http",
    "Headers": "code",
    "Body": "description",
    // Banco de Dados
    "Tipo de Banco": "dns",
    "Método de Conexão": "settings_ethernet",
    "Schema Padrão": "schema",
    "Host": "router",
    "Porta": "settings_input_hdmi",
    "Nome do Banco": "storage",
    "Usuário DB": "person_pin",
    "URL de Conexão": "link",
    // CSV Configs
    "Delimitador": "space_bar",
    "Caractere de Citação": "format_quote",
  };

  // Helper DB
  const fillDbDetails = (config) => {
      const details = {};
      details["Tipo de Banco"] = config.db_type || "postgres"; 
      details["Método de Conexão"] = config.db_connection_type === 'URL' ? "URL de Conexão" : "Host / Porta";

      if (config.db_connection_type === 'URL') {
          details["URL de Conexão"] = config.db_url;
      } else {
          details["Host"] = config.db_host;
          details["Porta"] = config.db_port;
          details["Nome do Banco"] = config.db_name;
          details["Usuário DB"] = config.db_user;
      }
      details["Schema Padrão"] = config.db_schema || "public";
      return details;
  };

  // Helper CSV
  const fillCsvDetails = (config) => {
      return {
          "Delimitador": config.csv_delimiter,
          "Caractere de Citação": config.csv_quote
      };
  };

  // Helper API (NOVO)
  const fillApiDetails = (config) => {
      // Formata headers JSON para string legível
      let headersStr = "";
      if (config.api_headers) {
          try {
             // Se já for objeto
             if (typeof config.api_headers === 'object') headersStr = JSON.stringify(config.api_headers); 
             // Se for string
             else headersStr = config.api_headers;
          } catch(e) { headersStr = String(config.api_headers); }
      }

      return {
          "Método": config.api_method || "GET",
          "Headers": headersStr.length > 50 ? headersStr.substring(0, 50) + "..." : headersStr,
          "Body": config.api_body ? "(Configurado)" : "Nenhum"
      };
  };

  // --- Lógica por Origem ---

  // 1. RH
  if (dataSource.origem_datasource === "RH" && dataSource.hrConfig) {
    const config = dataSource.hrConfig;
    
    // Prioridade: API > DB > CSV
    const isApi = config.api_url; 
    const isDb = config.db_host || config.db_url;

    if (isApi) {
        connectionDetails = {
            "Endpoint": config.api_url,
            ...fillApiDetails(config)
        };
    } else if (isDb) {
        connectionDetails = fillDbDetails(config);
        connectionDetails["Tabela RH"] = config.db_table; 
    } else {
        connectionDetails = { 
            "Diretório (Servidor)": config.diretorio_hr,
            ...fillCsvDetails(config)
        };
    }
  } 
  // 2. IDM (Legado API)
  else if (dataSource.origem_datasource === "IDM" && dataSource.idmConfig) {
    connectionDetails = {
      "API URL": dataSource.idmConfig.api_url,
      "API User": dataSource.idmConfig.api_user,
    };
  } 
  // 3. SISTEMA
  else if (dataSource.origem_datasource === "SISTEMA" && dataSource.systemConfig) {
    const config = dataSource.systemConfig;

    const typeContas = config.tipo_fonte_contas;
    const typeRecursos = config.tipo_fonte_recursos;

    // Se ALGUM for DB, mostra dados de DB
    if (typeContas === 'DATABASE' || typeRecursos === 'DATABASE') {
        const dbInfo = fillDbDetails(config);
        connectionDetails = { ...connectionDetails, ...dbInfo };
    }

    // Se ALGUM for API, mostra dados de API (Headers/Auth globais)
    if (typeContas === 'API' || typeRecursos === 'API') {
        const apiInfo = fillApiDetails(config);
        connectionDetails = { ...connectionDetails, ...apiInfo };
    }

    // Labels dinâmicos para os campos principais (que mudam de nome dependendo do tipo)
    // Contas
    if (typeContas === 'API') connectionDetails["Endpoint Contas"] = config.diretorio_contas;
    else if (typeContas === 'DATABASE') connectionDetails["Tabela Contas"] = config.diretorio_contas;
    else connectionDetails["Diretório Contas"] = config.diretorio_contas; // CSV

    // Recursos
    if (typeRecursos === 'API') connectionDetails["Endpoint Recursos"] = config.diretorio_recursos;
    else if (typeRecursos === 'DATABASE') connectionDetails["Tabela Recursos"] = config.diretorio_recursos;
    else connectionDetails["Diretório Recursos"] = config.diretorio_recursos; // CSV

    // Se ALGUM for CSV, mostra configs CSV
    if (typeContas === 'CSV' || typeRecursos === 'CSV') {
        const csvInfo = fillCsvDetails(config);
        connectionDetails = { ...connectionDetails, ...csvInfo };
    }
  }

  const connectionFields = Object.entries(connectionDetails).filter(
    ([_, val]) => val !== null && val !== undefined && val !== ""
  );


  // --- 2. Lógica de Mapeamento ---
  const { origem_datasource, mappingRH, mappingIDM, mappingSystem } = dataSource;
  
  let isMapped = false; 
  let contasMapeadas = false;
  let recursosMapeados = false;

  if (origem_datasource === "RH") {
    isMapped = mappingRH && mappingRH.identity_id_hr && mappingRH.email_hr && mappingRH.status_hr;
  } else if (origem_datasource === "IDM") {
    isMapped = mappingIDM && mappingIDM.identity_id_idm && mappingIDM.email_idm;
  } else if (origem_datasource === "SISTEMA" && mappingSystem) {
    contasMapeadas = mappingSystem.accounts_id_in_system && mappingSystem.accounts_identity_id;
    recursosMapeados = mappingSystem.resources_name;
    isMapped = contasMapeadas && recursosMapeados;
  }


  return (
    <Modal open={open} onClose={onClose} sx={{ display: "grid", placeItems: "center" }}>
      <Card sx={{ width: "90%", maxWidth: "700px", maxHeight: "90vh", overflowY: "auto" }}>
        <MDBox p={2} display="flex" justifyContent="space-between" alignItems="center">
          <MDTypography variant="h5">Detalhes da Fonte de Dados</MDTypography>
          <Icon
            sx={{ cursor: "pointer", color: darkMode ? "white" : "dark" }}
            onClick={onClose}
          >
            close
          </Icon>
        </MDBox>
        
        <Divider sx={{ my: 0 }} />

        <MDBox p={3}>
          <Grid container spacing={3}>
            {/* Coluna Esquerda: Dados Gerais */}
            <Grid item xs={12} md={6}>
              <DetailItem icon="label" label="Nome" value={dataSource.name_datasource} darkMode={darkMode} />
              <DetailItem icon="device_hub" label="Origem" value={dataSource.origem_datasource} darkMode={darkMode} />
              <DetailItem icon="storage" label="Tipo" value={dataSource.type_datasource} darkMode={darkMode} />
              <DetailItem icon="description" label="Descrição" value={dataSource.description_datasource} darkMode={darkMode} />
            </Grid>

            {/* Coluna Direita: Status e Mapeamento */}
            <Grid item xs={12} md={6}>
              <DetailItem icon="check_circle" label="Status" darkMode={darkMode}>
                 <MDBadge badgeContent={dataSource.status || "ATIVO"} color="success" variant="gradient" size="sm" container sx={{ ml: 1 }} />
              </DetailItem>

              {origem_datasource !== "SISTEMA" ? (
                  <DetailItem icon="rule" label="Mapeamento" darkMode={darkMode}>
                    <MDBadge badgeContent={isMapped ? "MAPEADO" : "PENDENTE"} color={isMapped ? "success" : "warning"} variant="gradient" size="sm" container sx={{ ml: 1 }} />
                  </DetailItem>
              ) : (
                  <>
                    <DetailItem icon="rule" label="Map. Contas" darkMode={darkMode}>
                        <MDBadge badgeContent={contasMapeadas ? "MAPEADO" : "PENDENTE"} color={contasMapeadas ? "success" : "warning"} variant="gradient" size="sm" container sx={{ ml: 1 }} />
                    </DetailItem>
                    <DetailItem icon="category" label="Map. Recursos" darkMode={darkMode}>
                        <MDBadge badgeContent={recursosMapeados ? "MAPEADO" : "PENDENTE"} color={recursosMapeados ? "success" : "warning"} variant="gradient" size="sm" container sx={{ ml: 1 }} />
                    </DetailItem>
                  </>
              )}

              <DetailItem icon="event" label="Criado em" value={dataSource.createdAt ? new Date(dataSource.createdAt).toLocaleString() : ""} darkMode={darkMode} />
              <DetailItem icon="update" label="Atualizado" value={dataSource.updatedAt ? new Date(dataSource.updatedAt).toLocaleString() : ""} darkMode={darkMode} />
            </Grid>
          </Grid>

          {/* Seção de Conexão */}
          {connectionFields.length > 0 && (
            <>
              <MDBox mt={3} mb={2}>
                <MDTypography variant="h6" fontWeight="medium">Detalhes da Conexão</MDTypography>
                <Divider />
              </MDBox>
              
              <Grid container spacing={2}>
                 {connectionFields.map(([key, val]) => (
                    <Grid item xs={12} md={6} key={key}>
                        <DetailItem 
                            icon={iconMap[key] || "info"} 
                            label={key} 
                            value={val} 
                            darkMode={darkMode} 
                        />
                    </Grid>
                 ))}
              </Grid>
            </>
          )}
        </MDBox>
      </Card>
    </Modal>
  );
}

DataSourceViewModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  dataSource: PropTypes.object,
  darkMode: PropTypes.bool,
};

export default DataSourceViewModal;