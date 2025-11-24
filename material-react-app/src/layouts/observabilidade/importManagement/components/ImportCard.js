// material-react-app/src/layouts/observabilidade/importManagement/components/ImportCard.js

import React, { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
// @mui/material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField"; 
import FormControlLabel from "@mui/material/FormControlLabel"; 
import Switch from "@mui/material/Switch"; 
import CircularProgress from "@mui/material/CircularProgress"; 
// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert"; 
import MDInput from "components/MDInput"; 
import { useMaterialUIController } from "context"; 
import Dropzone from "./Dropzone";


function ImportCard({ 
  onProcessUpload, 
  onProcessDirectory, // Essa função no pai (index.js) decide se chama /sync-db ou /process-directory
  dataSourceOptions,
  history, 
  isLoading, 
  onOpenTemplate 
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedDataSource, setSelectedDataSource] = useState(null); 
  const [importMode, setImportMode] = useState("directory"); // 'directory' ou 'upload'
  
  const [selectedOrigem, setSelectedOrigem] = useState(null);
  const [processingTarget, setProcessingTarget] = useState("CONTAS"); // "CONTAS" ou "RECURSOS"
  const origemOptions = ["RH", "IDM", "SISTEMA"];
  const targetOptions = ["CONTAS", "RECURSOS"];

  // Filtra a lista de fontes de dados com base na origem selecionada
  const filteredDataSources = useMemo(() => {
    if (!selectedOrigem) {
      return [];
    }
    return dataSourceOptions.filter(ds => ds.origem_datasource === selectedOrigem);
  }, [dataSourceOptions, selectedOrigem]);

  // Handlers
  const handleOrigemChange = (event, newValue) => {
    setSelectedOrigem(newValue);
    setSelectedDataSource(null); 
    setProcessingTarget("CONTAS"); 
    setSelectedFile(null); 
  };

  const handleDataSourceChange = (event, newValue) => {
    setSelectedDataSource(newValue);
    setProcessingTarget("CONTAS"); 
    setSelectedFile(null); 
  };
  
  const handleProcessingTargetChange = (event, newTarget) => {
    if (newTarget !== null) {
      setProcessingTarget(newTarget);
      setSelectedFile(null); 
    }
  };

  // Lógica de verificação de mapeamento
  const [isMappingMissing, setIsMappingMissing] = useState(false);
  const [mappingMissingMessage, setMappingMissingMessage] = useState("");

  useEffect(() => {
    if (!selectedDataSource) {
      setIsMappingMissing(false);
      setMappingMissingMessage("");
      return;
    }

    const { origem_datasource, mappingRH, mappingIDM, mappingSystem } = selectedDataSource;
    let missing = false;
    let message = 'O mapeamento de dados para esta fonte não foi configurado.';
    let missingFields = [];

    if (origem_datasource === "RH") {
      const map = mappingRH || {};
      if (!map.identity_id_hr) missingFields.push("identity_id_hr");
      if (!map.email_hr) missingFields.push("email_hr");
      if (!map.status_hr) missingFields.push("status_hr");
      if (missingFields.length > 0) {
        missing = true;
        message = `Mapeamento de RH incompleto.`;
      }
    } else if (origem_datasource === "IDM") {
      const map = mappingIDM || {};
      if (!map.identity_id_idm) missingFields.push("identity_id_idm");
      if (missingFields.length > 0) {
        missing = true;
        message = `Mapeamento de IDM incompleto.`;
      }
    } else if (origem_datasource === "SISTEMA") {
      const map = mappingSystem || {};
      if (processingTarget === "CONTAS") {
        if (!map.accounts_id_in_system) missingFields.push("accounts_id_in_system");
        if (!map.accounts_email) missingFields.push("accounts_email");
        // if (!map.accounts_identity_id) missingFields.push("accounts_identity_id"); <--- 🚨 LINHA REMOVIDA
        if (missingFields.length > 0) {
            missing = true;
            message = `Mapeamento de "Contas" incompleto.`;
        }
      } else if (processingTarget === "RECURSOS") {
        if (!map.resources_name) missingFields.push("resources_name");
        if (!map.resources_permissions) missingFields.push("resources_permissions");
        if (missingFields.length > 0) {
            missing = true;
            message = `Mapeamento de "Recursos" incompleto.`;
        }
      }
    }
    
    setIsMappingMissing(missing);
    setMappingMissingMessage(message);

  }, [selectedDataSource, processingTarget]);

  // Verifica se os RECURSOS para o sistema selecionado já foram importados com sucesso
  // (Pré-requisito para importar contas)
  const hasSuccessfullyImportedResources = useMemo(() => {
    if (!selectedDataSource || selectedDataSource.origem_datasource !== "SISTEMA") return true; 
    const currentSystemId = selectedDataSource.systemConfig?.systemId;
    if (!currentSystemId) return false; 
    return history.some(log =>
      log.dataSource?.systemConfig?.systemId === currentSystemId &&
      log.processingTarget === "RECURSOS" &&
      log.status === "SUCCESS"
    );
  }, [selectedDataSource, history]);


  // ======================= LÓGICA DE DETECÇÃO DE TIPO (CORRIGIDA) =======================
  const currentSourceType = useMemo(() => {
    if (!selectedDataSource) return null;
    
    const { origem_datasource, type_datasource, hrConfig, systemConfig } = selectedDataSource;

    if (origem_datasource === "IDM") return "API"; // IDM é sempre API

    if (origem_datasource === "RH") {
      // 1. Prioriza o campo type_datasource (CSV, DATABASE, API)
      if (type_datasource && type_datasource !== 'CSV') return type_datasource;
      
      // 2. Verifica fallback para DB (se configs de host/url estiverem preenchidas)
      if (hrConfig?.db_host || hrConfig?.db_url) return "DATABASE";
      
      return "CSV"; 
    }
    
    // SISTEMA: Verifica o tipo específico da aba (Contas ou Recursos)
    if (origem_datasource === "SISTEMA" && systemConfig) {
      // Retorna o valor literal do campo (que deve ser CSV, DATABASE ou API)
      const type = processingTarget === "CONTAS" 
        ? systemConfig.tipo_fonte_contas 
        : systemConfig.tipo_fonte_recursos;
      return type || "CSV";
    }
    
    return "CSV"; // Fallback
  }, [selectedDataSource, processingTarget]);
  
  // Se for Banco de Dados ou API, NÃO permite upload manual
  const allowUploadMode = currentSourceType === "CSV";
  
  // Força o modo "directory" (automático/sincronização) se não for CSV
  useEffect(() => {
    if (!allowUploadMode) {
      setImportMode("directory");
    }
  }, [allowUploadMode]);

  const handleModeChange = (event) => {
    setImportMode(event.target.checked ? "upload" : "directory");
    setSelectedFile(null); 
  };

  const handleProcessClick = () => {
    const callback = (errorOcurred = false) => {
      if (!errorOcurred) {
        setSelectedFile(null);
      }
    };

    if (!selectedDataSource) return;

    if (importMode === "upload") {
      // Rota de Upload manual (handleProcessUpload -> /imports/upload)
      onProcessUpload(selectedFile, selectedDataSource.id, processingTarget, callback);
    } else {
      // Rota de Sincronização/Diretório (onProcessDirectory -> handleTriggerProcessing)
      // O pai (index.js) decide se chama /sync-db ou /process-directory
      onProcessDirectory(selectedDataSource.id, processingTarget, callback);
    }
  };

  const isButtonDisabled = 
    isLoading || 
    !selectedDataSource || 
    (importMode === "upload" && !selectedFile) ||
    isMappingMissing ||
    (selectedOrigem === "SISTEMA" && processingTarget === "CONTAS" && !hasSuccessfullyImportedResources);

  // Labels Dinâmicos
  const getButtonLabel = () => {
      if (importMode === 'upload') return "Processar Arquivo";
      if (currentSourceType === 'DATABASE') return "Sincronizar Agora"; // Botão para DB
      if (currentSourceType === 'API') return "Sincronizar via API";
      return "Processar via Diretório"; // Botão para CSV no servidor
  };

  const getButtonIcon = () => {
      if (currentSourceType === 'DATABASE' || currentSourceType === 'API') return "sync";
      return "play_arrow";
  };
  // 

  return (
    <Card>
      <MDBox 
        mx={2} mt={-3} py={2} px={2} 
        variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info"
        display="flex" justifyContent="space-between" alignItems="center"
      >
        <MDTypography variant="h6" color="white">
          {currentSourceType === "DATABASE" ? "Sincronização de Banco de Dados" : (currentSourceType === "API" ? "Sincronização via API" : "Nova Importação")}
        </MDTypography>
        <MDButton variant="contained" color="dark" onClick={onOpenTemplate}>
          Ajuda
        </MDButton>
      </MDBox>
      <MDBox p={3}>
        <Grid container spacing={3} alignItems="flex-start">
          {/* Lado Esquerdo: Controles */}
          <Grid item xs={12} md={6}>
            <MDBox mb={2}>
              <Autocomplete 
                options={origemOptions}
                value={selectedOrigem}
                disabled={isLoading} 
                onChange={handleOrigemChange} 
                ListboxProps={{ sx: { backgroundColor: darkMode ? "grey.800" : "white" } }}
                renderInput={(params) => <MDInput {...params} label="1. Selecione a Origem" variant="outlined" />} 
              />
            </MDBox>
            
            <MDBox mb={2}>
              <Autocomplete 
                options={filteredDataSources}
                getOptionLabel={(option) => option.name_datasource || "Nome não encontrado"}
                value={selectedDataSource}
                disabled={isLoading || !selectedOrigem} 
                onChange={handleDataSourceChange} 
                ListboxProps={{ sx: { backgroundColor: darkMode ? "grey.800" : "white" } }}
                renderInput={(params) => <MDInput {...params} label="2. Selecione a Fonte de Dados" variant="outlined" />} 
              />
            </MDBox>

            {selectedOrigem === "SISTEMA" && selectedDataSource && (
              <MDBox mb={2}>
                <Autocomplete 
                  options={targetOptions}
                  value={processingTarget}
                  disabled={isLoading} 
                  onChange={handleProcessingTargetChange}
                  getOptionDisabled={(option) => option === "CONTAS" && !hasSuccessfullyImportedResources}
                  ListboxProps={{ sx: { backgroundColor: darkMode ? "grey.800" : "white" } }}
                  renderInput={(params) => (
                    <MDInput 
                      {...params} 
                      label="3. Selecione o Alvo do Processamento" 
                      variant="outlined" 
                      helperText={!hasSuccessfullyImportedResources ? "Importe 'RECURSOS' primeiro para habilitar 'CONTAS'." : ""}
                      FormHelperTextProps={{ sx: { marginLeft: 1, color: 'warning.main', fontWeight: 'bold' } }}
                    />
                  )} 
                />
              </MDBox>
            )}
            
            {isMappingMissing && (
              <MDAlert color="warning" sx={{ mt: 2, mb: 1 }}>
                <MDTypography variant="body2" color="white" fontWeight="medium">Mapeamento Pendente: </MDTypography>
                <MDTypography variant="body2" color="white">{mappingMissingMessage}</MDTypography>
              </MDAlert>
            )}

            {/* Só mostra o switch se for CSV */}
            {allowUploadMode && (
              <MDBox mb={2}>
                <FormControlLabel
                  control={
                    <Switch 
                      checked={importMode === "upload"} 
                      onChange={handleModeChange} 
                      disabled={isLoading}
                      sx={{ "& .MuiSwitch-thumb": { backgroundColor: "white" }, "& .Mui-checked+.MuiSwitch-track": { backgroundColor: "info.main" } }}
                    />
                  }
                  label={<MDTypography variant="button" color="text">Fazer upload manual de arquivo</MDTypography>}
                />
              </MDBox>
            )}
            
            <MDButton variant="gradient" color="info" fullWidth onClick={handleProcessClick} disabled={isButtonDisabled}>
              {isLoading ? <CircularProgress size={20} color="white" /> : <><Icon>{getButtonIcon()}</Icon>&nbsp;{getButtonLabel()}</>}
            </MDButton>
          </Grid>

          {/* Lado Direito: Dropzone ou Painel Informativo */}
          <Grid item xs={12} md={6}>
            {importMode === 'upload' && allowUploadMode ? (
              <Dropzone 
                file={selectedFile}
                onFileSelect={setSelectedFile}
                system={selectedDataSource ? selectedDataSource.name_datasource : null}
                disabled={!selectedDataSource || isLoading}
                disabledText="Selecione uma fonte de dados primeiro"
              />
            ) : (
              // Painel Informativo (para Diretório CSV, DB ou API)
              <MDBox
                display="flex"
                flexDirection="column"
                justifyContent="center"
                alignItems="center"
                sx={(theme) => ({
                  border: "2px dashed",
                  borderColor: theme.palette.grey[500],
                  borderRadius: "10px",
                  textAlign: "center",
                  padding: "24px",
                  cursor: "default",
                  transition: "all 0.3s ease-in-out",
                  backgroundColor: "transparent", 
                  minHeight: "200px", 
                })}
              >
                <Icon fontSize="large" sx={{ color: 'info.main', fontSize: '3rem !important', mb: 2 }}>
                  {currentSourceType === "DATABASE" ? "storage" : (currentSourceType === "API" ? "cloud_sync" : "folder_open")}
                </Icon>
                <MDTypography variant="h6" mt={1} fontSize="1.1rem" color="text">
                  {currentSourceType === "DATABASE" ? "Sincronização de Banco de Dados" : (currentSourceType === "API" ? "Sincronização via API" : "Processamento via Diretório")}
                </MDTypography>
                <MDTypography variant="body2" color="text" align="center" mt={1} px={3}>
                  {currentSourceType === "DATABASE" 
                    ? `Os dados serão extraídos diretamente da tabela configurada no banco de dados de ${selectedDataSource ? selectedDataSource.name_datasource : 'origem'}.`
                    : (currentSourceType === "API" 
                        ? "Os dados serão buscados via requisição à API configurada."
                        : "O sistema buscará o arquivo CSV mais recente no diretório configurado no servidor.")
                  }
                </MDTypography>
              </MDBox>
            )}
          </Grid>
        </Grid>
      </MDBox>
    </Card>
  );
}

ImportCard.propTypes = {
  onProcessUpload: PropTypes.func.isRequired,
  onProcessDirectory: PropTypes.func.isRequired,
  dataSourceOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
  history: PropTypes.arrayOf(PropTypes.object),
  isLoading: PropTypes.bool,
  onOpenTemplate: PropTypes.func.isRequired,
};

ImportCard.defaultProps = {
  isLoading: false,
  history: [],
};

export default ImportCard;