// material-react-app/src/layouts/observabilidade/mapeamentoDados/index.js

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useMaterialUIController } from "context";

// Componentes UI
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDAlert from "components/MDAlert";
import CircularProgress from "@mui/material/CircularProgress";
import { Autocomplete } from "@mui/material";
import MDInput from "components/MDInput";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Icon from "@mui/material/Icon";
import MDSnackbar from "components/MDSnackbar";

// Componentes Refatorados
import MappingForm from "./components/MappingForm";
import { useColumnFetcher } from "./hooks/useColumnFetcher";

// --- CONSTANTES DE MAPEAMENTO ---
const SCHEMA_MAP = {
  RH: [ "identity_id_hr", "name_hr", "email_hr", "status_hr", "user_type_hr", "cpf_hr", "extra_data_hr" ],
  IDM: [ "identity_id_idm", "name_idm", "email_idm", "status_idm", "extra_data_idm" ],
  SISTEMA_CONTAS: [ "accounts_id_in_system", "accounts_name", "accounts_email", "accounts_cpf", "accounts_status", "accounts_identity_id", "accounts_resource_name" ],
  SISTEMA_RECURSOS: [ "resources_name", "resources_description", "resources_permissions" ],
};
const REQUIRED_FIELDS_MAP = {
  RH: ["identity_id_hr", "email_hr", "status_hr"],
  IDM: ["identity_id_idm", "email_idm", "status_idm"], 
  SISTEMA_CONTAS: [ "accounts_id_in_system", "accounts_email", "accounts_identity_id", "accounts_resource_name" ], 
  SISTEMA_RECURSOS: ["resources_name", "resources_permissions"],
};
const DESCRIPTION_MAP = {
  "identity_id_hr": "Obrigatório. Chave única da identidade (ex: Matrícula, ID Único).",
  "name_hr": "Opcional. Nome completo do colaborador.",
  "email_hr": "Obrigatório. Email corporativo (usado para vínculo se o ID falhar).",
  "status_hr": "Obrigatório. Situação no RH (ex: 'Ativo', 'Inativo', 'Ferias').",
  "user_type_hr": "Opcional. Tipo de colaborador (ex: 'Funcionario', 'Terceiro').",
  "cpf_hr": "Opcional, mas recomendado. CPF (usado para vínculo e divergências).",
  "extra_data_hr": "Opcional. Outros dados que deseja armazenar (ex: Centro de Custo).",
  "accounts_id_in_system": "Obrigatório. Chave única da conta no sistema (ex: Login).",
  "accounts_name": "Opcional. Nome de exibição da conta.",
  "accounts_email": "Obrigatório. Email da conta no sistema.",
  "accounts_cpf": "Opcional. CPF registrado no sistema.",
  "accounts_status": "Opcional. Status da conta no sistema.",
  "accounts_identity_id": "Obrigatório. O ID do RH para vínculo.",
  "accounts_resource_name": "Obrigatório. Lista de perfis/recursos (separados por ';').",
  "resources_name": "Obrigatório. Nome/ID único do recurso/perfil.",
  "resources_description": "Opcional. Descrição do recurso.",
  "resources_permissions": "Obrigatório. Lista de permissões (ex: \"leitura;escrita\")."
};


function MapeamentoDados() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const [loadingList, setLoadingList] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState(null);

  const [allDataSources, setAllDataSources] = useState([]);
  const [selectedDataSource, setSelectedDataSource] = useState(null);
  const [selectedOrigem, setSelectedOrigem] = useState(null);
  const origemOptions = ["RH", "IDM", "SISTEMA"];

  const [mappingTarget, setMappingTarget] = useState("CONTAS");
  const [mappings, setMappings] = useState({});
  const [notification, setNotification] = useState({ open: false, color: "info", message: "" });

  const api = axios.create({
    baseURL: "/",
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  // 1. Buscar Lista de Fontes
  useEffect(() => {
    const fetchAllDataSources = async () => {
      setLoadingList(true);
      try {
        const response = await api.get("/systems");
        const data = response.data || [];
        setAllDataSources(data);

        if (id) {
          const idAsNumber = parseInt(id, 10);
          const sourceFromUrl = data.find(s => s.id === idAsNumber);
          if (sourceFromUrl) {
            setSelectedOrigem(sourceFromUrl.origem_datasource);
            setSelectedDataSource(sourceFromUrl);
            // Se for sistema, reseta para a aba CONTAS por padrão
            if (sourceFromUrl.origem_datasource === "SISTEMA") {
                setMappingTarget("CONTAS");
            }
          } else {
            setPageError(`Fonte de dados com ID ${id} não encontrada.`);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar fontes:", err);
        setPageError("Erro ao buscar lista de fontes.");
      } finally {
        setLoadingList(false);
      }
    };
    fetchAllDataSources();
  }, [id]);

  // 2. Hook: Busca colunas (CSV ou DB) automaticamente quando a fonte ou a aba muda
  const { columns: sourceColumns, loading: loadingCols, error: colsError } = useColumnFetcher(selectedDataSource, mappingTarget);


  // 3. Determina o Schema (RH, SISTEMA_CONTAS, SISTEMA_RECURSOS)
  const currentSchemaKey = useMemo(() => {
    if (!selectedDataSource) return null;
    const origem = selectedDataSource.origem_datasource;
    if (origem === "SISTEMA") return `SISTEMA_${mappingTarget}`;
    return origem;
  }, [selectedDataSource, mappingTarget]);

  // 4. Carrega Mapeamentos Salvos (Preenche o formulário)
  useEffect(() => {
    if (!selectedDataSource) {
        setMappings({});
        return;
    }
    
    const origem = selectedDataSource.origem_datasource;
    let savedMappingsDB = {}; 
    const savedMappingsUI = {};

    if (origem === "RH") savedMappingsDB = selectedDataSource.mappingRH || {};
    else if (origem === "IDM") savedMappingsDB = selectedDataSource.mappingIDM || {};
    else if (origem === "SISTEMA") {
        savedMappingsDB = selectedDataSource.mappingSystem || {};
        
        // Filtra chaves baseadas na aba atual
        const prefix = mappingTarget === "CONTAS" ? "accounts_" : "resources_";
        
        Object.keys(savedMappingsDB).forEach(key => {
            if (key.startsWith(prefix)) {
                savedMappingsUI[key] = savedMappingsDB[key];
            }
        });
        setMappings(savedMappingsUI);
        return;
    }
    
    // Para RH/IDM
    Object.assign(savedMappingsUI, savedMappingsDB);
    delete savedMappingsUI.id;
    delete savedMappingsUI.dataSourceId;
    setMappings(savedMappingsUI);

  }, [selectedDataSource, mappingTarget]);


  // --- Handlers ---

  const handleOrigemChange = (event, newValue) => {
    setSelectedOrigem(newValue);
    setMappingTarget("CONTAS");
    setSelectedDataSource(null);
    navigate(`/observabilidade/mapeamento-dados`);
  };

  const handleDropdownChange = (event, newValue) => {
    setSelectedDataSource(newValue);
    if (newValue) navigate(`/observabilidade/mapeamento-dados/${newValue.id}`);
    else navigate(`/observabilidade/mapeamento-dados`);
  };

  const handleMappingTargetChange = (event, newIndex) => {
    // Troca a aba e limpa o mapeamento visual momentaneamente
    const newTarget = newIndex === 0 ? "CONTAS" : "RECURSOS";
    setMappingTarget(newTarget);
    setMappings({}); // O useEffect de carga vai preencher com os dados salvos
  };

  const handleMappingChange = (key, value) => {
    setMappings(prev => ({ ...prev, [key]: value }));
  };

  const handleSaveMapping = async () => {
    if (!selectedDataSource) return;
    setSaving(true);

    try {
      let finalPayload = mappings;
      
      // Para Sistema, mescla com o mapeamento da outra aba que já existe no banco
      if (selectedDataSource.origem_datasource === "SISTEMA") {
          const fullSavedMap = selectedDataSource.mappingSystem || {};
          const prefixToKeep = mappingTarget === "CONTAS" ? "resources_" : "accounts_";
          
          const otherTabKeys = {};
          Object.keys(fullSavedMap).forEach(key => {
              if (key.startsWith(prefixToKeep)) otherTabKeys[key] = fullSavedMap[key];
          });
          
          finalPayload = { ...otherTabKeys, ...mappings };
      }
      
      // Remove IDs internos
      delete finalPayload.id;
      delete finalPayload.dataSourceId;

      await api.post(`/systems/${selectedDataSource.id}/mapping`, finalPayload);

      // Atualiza o estado local para refletir o salvamento
      if (selectedDataSource.origem_datasource === "SISTEMA") {
          setSelectedDataSource(prev => ({ ...prev, mappingSystem: finalPayload }));
      } else if (selectedDataSource.origem_datasource === "RH") {
          setSelectedDataSource(prev => ({ ...prev, mappingRH: finalPayload }));
      }

      setNotification({ open: true, color: "success", message: "Mapeamento salvo com sucesso!" });

    } catch (err) {
      console.error("Erro ao salvar:", err);
      setNotification({ open: true, color: "error", message: "Erro ao salvar o mapeamento." });
    } finally {
      setSaving(false);
    }
  };

  // Prepara campos para o componente visual
  const formFields = useMemo(() => {
    if (!currentSchemaKey) return [];
    const schema = SCHEMA_MAP[currentSchemaKey] || [];
    const requiredFields = REQUIRED_FIELDS_MAP[currentSchemaKey] || [];

    return schema.map(key => ({
        key,
        value: mappings[key] || null,
        required: requiredFields.includes(key),
        description: DESCRIPTION_MAP[key]
    }));
  }, [currentSchemaKey, mappings]);

  // Validação do botão Salvar
  const isSaveDisabled = useMemo(() => {
     return formFields.some(f => f.required && !f.value);
  }, [formFields]);

  const filteredDataSources = useMemo(() => {
    if (!selectedOrigem) return [];
    return allDataSources.filter(ds => ds.origem_datasource === selectedOrigem);
  }, [allDataSources, selectedOrigem]);

  const closeNotification = () => setNotification({ ...notification, open: false });


  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card>
              <MDBox mx={2} mt={-3} py={3} px={2} variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info">
                <MDTypography variant="h6" color="white">Mapeamento de Dados</MDTypography>
              </MDBox>
              <MDBox p={3}>
                <MDBox mb={3}>
                  <MDTypography variant="h5">Selecionar Fonte de Dados</MDTypography>
                  <MDTypography variant="body2" color="text" mt={1} mb={2}>
                    Selecione o tipo de origem e a fonte de dados para iniciar o mapeamento.
                  </MDTypography>
                  
                  {loadingList ? (
                    <MDBox display="flex" justifyContent="center"><CircularProgress color="info" /></MDBox>
                  ) : (
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={origemOptions}
                          value={selectedOrigem}
                          onChange={handleOrigemChange}
                          renderInput={(params) => <MDInput {...params} label="1. Selecionar Tipo de Origem" variant="outlined" />}
                          ListboxProps={{ sx: { backgroundColor: darkMode ? "grey.800" : "white" } }}
                          fullWidth
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Autocomplete
                          options={filteredDataSources}
                          getOptionLabel={(option) => option.name_datasource || "Nome não encontrado"}
                          value={selectedDataSource}
                          disabled={!selectedOrigem || filteredDataSources.length === 0}
                          onChange={handleDropdownChange}
                          renderInput={(params) => <MDInput {...params} label="2. Selecionar Fonte de Dados" variant="outlined" />}
                          ListboxProps={{ sx: { backgroundColor: darkMode ? "grey.800" : "white" } }}
                          fullWidth
                        />
                      </Grid>
                    </Grid>
                  )}
                </MDBox>

                {/* Seletor de Abas (Apenas para SISTEMA) */}
                {selectedOrigem === "SISTEMA" && selectedDataSource && (
                  <MDBox mb={3}>
                    <MDTypography variant="h6" fontSize="0.875rem" mb={1}>3. Selecionar Tipo de Mapeamento</MDTypography>
                    <Tabs
                      value={mappingTarget === "CONTAS" ? 0 : 1}
                      onChange={handleMappingTargetChange}
                      textColor="inherit"
                      indicatorColor="info"
                    >
                      <Tab label="Contas" icon={<Icon fontSize="small" sx={{ mr: 1 }}>person</Icon>} iconPosition="start" />
                      <Tab label="Recursos" icon={<Icon fontSize="small" sx={{ mr: 1 }}>workspaces</Icon>} iconPosition="start" />
                    </Tabs>
                  </MDBox>
                )}

                {(pageError || colsError) && (
                  <MDAlert color="error" sx={{ mb: 2 }}>
                    <MDTypography variant="body2" color="white">{pageError || colsError}</MDTypography>
                  </MDAlert>
                )}
              </MDBox>
            </Card>
          </Grid>
          
          {!loadingList && selectedDataSource && selectedOrigem && (
            <Grid item xs={12} mt={3}> 
              {loadingCols ? (
                <MDBox display="flex" justifyContent="center" alignItems="center" minHeight="20vh">
                  <CircularProgress color="info" />
                </MDBox>
              ) : (
                <MappingForm 
                    title={`Colunas da Aplicação (${selectedDataSource.origem_datasource === "SISTEMA" ? mappingTarget : selectedDataSource.origem_datasource})`}
                    description={`Mapeie as colunas da sua fonte de dados (${selectedDataSource.type_datasource || 'CSV'}) para os campos da aplicação.`}
                    fields={formFields}
                    availableColumns={sourceColumns} // Colunas vindas do Hook (CSV ou DB)
                    onMappingChange={handleMappingChange}
                    onSave={handleSaveMapping}
                    isSaveDisabled={isSaveDisabled}
                    loading={saving}
                />
              )}
            </Grid>
          )}
        </Grid>
      </MDBox>
      
      <MDSnackbar
        color={notification.color}
        icon={notification.color === "success" ? "check" : "notifications"}
        title="Mapeamento de Dados"
        content={notification.message}
        dateTime="agora"
        open={notification.open}
        onClose={closeNotification}
        close={closeNotification}
      />
      
    </DashboardLayout>
  );
}

export default MapeamentoDados;