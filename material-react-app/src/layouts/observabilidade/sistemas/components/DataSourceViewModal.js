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
    // API
    "API URL": "link",
    "API User": "person",
    // Banco de Dados - Geral
    "Tipo de Banco": "dns",
    "Método de Conexão": "settings_ethernet",
    "Schema Padrão": "schema",
    // Banco de Dados - Host
    "Host": "router",
    "Porta": "settings_input_hdmi",
    "Nome do Banco": "storage",
    "Usuário DB": "person_pin",
    // Banco de Dados - URL
    "URL de Conexão": "link",
  };

  // Helper para preencher dados de DB
  const fillDbDetails = (config) => {
      const details = {};
      
      // Tipo e Método
      details["Tipo de Banco"] = config.db_type || "postgres"; // Default postgres se nulo
      details["Método de Conexão"] = config.db_connection_type === 'URL' ? "URL de Conexão" : "Host / Porta";

      // Detalhes Específicos
      if (config.db_connection_type === 'URL') {
          details["URL de Conexão"] = config.db_url;
      } else {
          details["Host"] = config.db_host;
          details["Porta"] = config.db_port;
          details["Nome do Banco"] = config.db_name;
          details["Usuário DB"] = config.db_user;
      }

      // Schema (Sempre útil)
      details["Schema Padrão"] = config.db_schema || "public";
      return details;
  };

  // --- Lógica por Origem ---

  // 1. RH
  if (dataSource.origem_datasource === "RH" && dataSource.hrConfig) {
    const config = dataSource.hrConfig;
    // Verifica se é DB (se tem host ou url preenchido) ou CSV
    const isDb = config.db_host || config.db_url;

    if (isDb) {
        connectionDetails = fillDbDetails(config);
        connectionDetails["Tabela RH"] = config.db_table; // Nome específico para RH
        iconMap["Tabela RH"] = "table_view";
    } else {
        connectionDetails = { "Diretório (Servidor)": config.diretorio_hr };
    }
  } 
  // 2. IDM
  else if (dataSource.origem_datasource === "IDM" && dataSource.idmConfig) {
    connectionDetails = {
      "API URL": dataSource.idmConfig.api_url,
      "API User": dataSource.idmConfig.api_user,
    };
  } 
  // 3. SISTEMA
  else if (dataSource.origem_datasource === "SISTEMA" && dataSource.systemConfig) {
    const config = dataSource.systemConfig;

    // Verifica se alguma das fontes usa banco de dados
    const isDbContas = config.tipo_fonte_contas === 'DATABASE';
    const isDbRecursos = config.tipo_fonte_recursos === 'DATABASE';

    if (isDbContas || isDbRecursos) {
        const dbInfo = fillDbDetails(config);
        connectionDetails = { ...connectionDetails, ...dbInfo };
    }

    // Adiciona os caminhos/tabelas
    const labelContas = isDbContas ? "Tabela Contas" : "Diretório Contas";
    const labelRecursos = isDbRecursos ? "Tabela Recursos" : "Diretório Recursos";

    connectionDetails[labelContas] = config.diretorio_contas;
    connectionDetails[labelRecursos] = config.diretorio_recursos;
  }

  // Filtra campos nulos/undefined (mas mantém strings vazias se desejar mostrar que está vazio, aqui filtramos tudo que é falsy/nulo)
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