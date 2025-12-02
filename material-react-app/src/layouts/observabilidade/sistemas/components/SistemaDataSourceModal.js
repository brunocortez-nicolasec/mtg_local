import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios"; 

// @mui material components
import Modal from "@mui/material/Modal";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Autocomplete from "@mui/material/Autocomplete";
import Collapse from "@mui/material/Collapse";
import Tooltip from "@mui/material/Tooltip";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import FormLabel from "@mui/material/FormLabel";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress"; 

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";

const tipoFonteSistemaOptions = ["CSV", "DATABASE", "API"];
const databaseTypeOptions = ["postgres", "mysql", "oracle", "sqlserver"]; 
const apiMethodOptions = ["GET", "POST"]; // Novo: Opções de Método

function SistemaDataSourceModal({ open, onClose, onSave, initialData }) {
  
  const [step, setStep] = useState(1); 
  const [isCreatingSystem, setIsCreatingSystem] = useState(false);
  
  const defaultState = {
    name: "",
    origem: "SISTEMA",
    description: "",
    systemId: null, 
    
    // Config Contas
    tipo_fonte_contas: "CSV",
    diretorio_contas: "",
    
    // Config Recursos
    tipo_fonte_recursos: "CSV",
    diretorio_recursos: "",

    // Config DB
    db_type: "postgres",
    db_connection_type: "HOST", 
    db_host: "",
    db_port: "5432",
    db_name: "",
    db_user: "",
    db_password: "",
    db_url: "",
    db_schema: "public",

    // Config CSV
    csv_delimiter: ",", 
    csv_quote: "\"",   

    // --- NOVOS CAMPOS API (Compartilhados) ---
    api_method: "GET",
    api_headers: '{"Content-Type": "application/json"}',
    api_body: "",
    api_response_path: "",

    // Status de Teste
    testStatusContas: { show: false, color: "info", message: "" },
    isTestingContas: false,
    testStatusRecursos: { show: false, color: "info", message: "" },
    isTestingRecursos: false,
    
    saveError: null,
  };

  const [formData, setFormData] = useState(defaultState);
  
  const API_URL = process.env.REACT_APP_API_URL;

  const api = axios.create({
    baseURL: API_URL, 
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  
  useEffect(() => {
    if (open) {
      if (initialData) {
        setStep(2); 
        const config = initialData.systemConfig || {};
        
        setFormData({
            ...defaultState,
            name: initialData.name_datasource || "",
            description: initialData.description_datasource || "",
            systemId: config.systemId || null,
            
            tipo_fonte_contas: config.tipo_fonte_contas || "CSV",
            diretorio_contas: config.diretorio_contas || "",
            
            tipo_fonte_recursos: config.tipo_fonte_recursos || "CSV",
            diretorio_recursos: config.diretorio_recursos || "",

            db_type: config.db_type || "postgres",
            db_connection_type: config.db_connection_type || "HOST",
            db_host: config.db_host || "",
            db_port: config.db_port || (config.db_type === 'oracle' ? "1521" : "5432"),
            db_name: config.db_name || "",
            db_user: config.db_user || "",
            db_password: config.db_password || "",
            db_url: config.db_url || "",
            db_schema: config.db_schema || (config.db_type === 'oracle' ? "" : "public"),

            csv_delimiter: config.csv_delimiter || ",", 
            csv_quote: config.csv_quote || "\"",      

            // API Fields
            api_method: config.api_method || "GET",
            api_headers: config.api_headers ? JSON.stringify(config.api_headers, null, 2) : '{"Content-Type": "application/json"}',
            api_body: config.api_body || "",
            api_response_path: config.api_response_path || "",
            
            testStatusContas: { show: false, color: "success" }, 
            testStatusRecursos: { show: false, color: "success" }, 
        });
        
      } else {
        setStep(1); 
        setFormData(defaultState);
      }
    }
  }, [initialData, open]);

  // Limpa status de teste ao mudar configurações chave
  useEffect(() => {
    setFormData(prev => ({
       ...prev,
       testStatusContas: { show: false, color: "info", message: "" }, 
       testStatusRecursos: { show: false, color: "info", message: "" }
    }));
  }, [
    formData.db_connection_type, formData.db_host, formData.db_port, 
    formData.db_name, formData.db_user, formData.db_password, 
    formData.db_url, formData.db_schema, formData.db_type,
    formData.csv_delimiter, formData.csv_quote,
    formData.api_headers, formData.api_method // Adicionado API
  ]);

  useEffect(() => {
     setFormData(prev => ({ ...prev, testStatusContas: { show: false, color: "info", message: "" } }));
  }, [formData.tipo_fonte_contas, formData.diretorio_contas]);

  useEffect(() => {
     setFormData(prev => ({ ...prev, testStatusRecursos: { show: false, color: "info", message: "" } }));
  }, [formData.tipo_fonte_recursos, formData.diretorio_recursos]);


  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };
  
  const handleAutocompleteChange = (name, newValue) => {
    setFormData((prev) => {
        const updates = { [name]: newValue };
        if (name === "db_type") {
            if (newValue === "oracle") updates.db_port = "1521";
            else if (newValue === "postgres") updates.db_port = "5432";
            else if (newValue === "mysql") updates.db_port = "3306";
            else if (newValue === "sqlserver") updates.db_port = "1433";
        }
        return { ...prev, ...updates };
    });
  };
  
  const handleNextStep = () => {
    if (!formData.name) return;
    setStep(2);
  };

  const handleTestCSV = async (diretorio, setTesting, setStatusState) => {
    if (!diretorio) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Insira o diretório para testar." } }));
        return;
    }
    setFormData(prev => ({ ...prev, [setTesting]: true, [setStatusState]: { show: true, color: "info", message: "Testando conexão com o arquivo..." } }));
    
    try {
      const response = await api.post("/datasources/test-csv", { 
          diretorio,
          delimiter: formData.csv_delimiter,
          quote: formData.csv_quote
      });
      const colsCount = response.data.detectedColumns || 0;
      setFormData(prev => ({ 
        ...prev, 
        [setStatusState]: { show: true, color: "success", message: `Sucesso! Encontrado (${colsCount} colunas).` } 
      }));
    } catch (error) {
      const message = error.response?.data?.message || "Erro desconhecido.";
      setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "error", message: `Falha: ${message}` } }));
    } finally {
      setFormData(prev => ({ ...prev, [setTesting]: false }));
    }
  };

  const handleTestDB = async (tableName, setTesting, setStatusState) => {
    if (!tableName) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Informe o nome da Tabela para validar." } }));
        return;
    }

    if (formData.db_connection_type === "HOST") {
        if (!formData.db_host || !formData.db_port || !formData.db_user || !formData.db_name) {
            setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Preencha os dados de conexão do Banco (Host, User, etc)." } }));
            return;
        }
    } else {
        if (!formData.db_url) {
            setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Preencha a URL de conexão." } }));
            return;
        }
    }

    setFormData(prev => ({ ...prev, [setTesting]: true, [setStatusState]: { show: true, color: "info", message: `Conectando e verificando tabela '${tableName}'...` } }));

    try {
        const response = await api.post("/datasources/test-db", { 
            connectionType: formData.db_connection_type,
            host: formData.db_host,
            port: formData.db_port,
            user: formData.db_user,
            password: formData.db_password,
            database: formData.db_name,
            url: formData.db_url,
            type: formData.db_type,
            schema: formData.db_schema,
            table: tableName 
        });
        
        let successMsg = response.data.message;
        if (response.data.columns?.length > 0) {
             const colList = response.data.columns.slice(0, 3).join(", "); 
             successMsg = `OK! Tabela encontrada. Cols: [${colList}...]`;
        }
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "success", message: successMsg } }));
    } catch (error) {
        const message = error.response?.data?.message || "Erro desconhecido.";
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "error", message: `Falha: ${message}` } }));
    } finally {
        setFormData(prev => ({ ...prev, [setTesting]: false }));
    }
  };

  // --- NOVA FUNÇÃO: Teste API ---
  const handleTestAPI = async (endpointUrl, setTesting, setStatusState) => {
    if (!endpointUrl) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Informe a URL do Endpoint." } }));
        return;
    }

    let headersJson = {};
    try {
        if (formData.api_headers) headersJson = JSON.parse(formData.api_headers);
    } catch (e) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "error", message: "Headers JSON inválido." } }));
        return;
    }

    setFormData(prev => ({ ...prev, [setTesting]: true, [setStatusState]: { show: true, color: "info", message: "Enviando requisição API..." } }));

    try {
        const response = await api.post("/datasources/test-api", {
            apiUrl: endpointUrl, // Usamos o campo específico (contas ou recursos) como URL
            method: formData.api_method,
            headers: headersJson,
            body: formData.api_body,
            responsePath: formData.api_response_path
        });

        let successMsg = response.data.message;
        if (response.data.detectedColumns?.length > 0) {
            successMsg += ` Colunas: [${response.data.detectedColumns.slice(0, 3).join(", ")}...]`;
        }
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "success", message: successMsg } }));

    } catch (error) {
        const message = error.response?.data?.message || error.message;
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "error", message: `Falha API: ${message}` } }));
    } finally {
        setFormData(prev => ({ ...prev, [setTesting]: false }));
    }
  };
  
  const handleTestContas = () => {
    if (formData.tipo_fonte_contas === "CSV") handleTestCSV(formData.diretorio_contas, 'isTestingContas', 'testStatusContas');
    else if (formData.tipo_fonte_contas === "DATABASE") handleTestDB(formData.diretorio_contas, 'isTestingContas', 'testStatusContas');
    else if (formData.tipo_fonte_contas === "API") handleTestAPI(formData.diretorio_contas, 'isTestingContas', 'testStatusContas');
  };

  const handleTestRecursos = () => {
    if (formData.tipo_fonte_recursos === "CSV") handleTestCSV(formData.diretorio_recursos, 'isTestingRecursos', 'testStatusRecursos');
    else if (formData.tipo_fonte_recursos === "DATABASE") handleTestDB(formData.diretorio_recursos, 'isTestingRecursos', 'testStatusRecursos');
    else if (formData.tipo_fonte_recursos === "API") handleTestAPI(formData.diretorio_recursos, 'isTestingRecursos', 'testStatusRecursos');
  };

  const getSaveDisabled = () => {
      if (isCreatingSystem) return true; 
      if (formData.isTestingContas || formData.isTestingRecursos) return true;
      
      // Validação: Exige sucesso no teste (exceto se for API e não testou ainda - opcional)
      if (formData.tipo_fonte_contas !== 'API') {
          if (formData.testStatusContas.color !== 'success') return true;
      }
      if (formData.tipo_fonte_recursos !== 'API') {
           if (formData.testStatusRecursos.color !== 'success') return true;
      }
      return false;
  };
  
  const handleSave = async () => {
    setFormData(prev => ({ ...prev, saveError: null }));
    setIsCreatingSystem(true);

    let finalHeaders = {};
    try { if (formData.api_headers) finalHeaders = JSON.parse(formData.api_headers); } catch(e) {}

    try {
        let finalSystemId = formData.systemId;
        if (!finalSystemId && !initialData) {
            const response = await api.post("/systems-catalog", {
                name_system: formData.name,
                description_system: formData.description
            });
            finalSystemId = response.data.id;
        }

        const payload = {
            name: formData.name,
            origem: "SISTEMA",
            description: formData.description,
            systemId: finalSystemId, 
            
            tipo_fonte_contas: formData.tipo_fonte_contas,
            diretorio_contas: formData.diretorio_contas, // Serve como URL no modo API
            tipo_fonte_recursos: formData.tipo_fonte_recursos,
            diretorio_recursos: formData.diretorio_recursos, // Serve como URL no modo API

            db_connection_type: formData.db_connection_type,
            db_host: formData.db_host,
            db_port: formData.db_port,
            db_name: formData.db_name,
            db_user: formData.db_user,
            db_password: formData.db_password,
            db_type: formData.db_type,
            db_url: formData.db_url,
            db_schema: formData.db_schema,
            
            csv_delimiter: formData.csv_delimiter,
            csv_quote: formData.csv_quote,

            // API Fields
            api_method: formData.api_method,
            api_headers: finalHeaders,
            api_body: formData.api_body,
            api_response_path: formData.api_response_path,
        };

        await onSave(payload); 
        
    } catch (error) {
        console.error("Erro no fluxo de salvamento:", error);
        const message = error.response?.data?.message || "Erro ao criar sistema ou salvar configurações.";
        setFormData(prev => ({ ...prev, saveError: message }));
    } finally {
        setIsCreatingSystem(false);
    }
  };
  
  const renderDbFields = () => {
    // Variáveis Dinâmicas
    const isOracle = formData.db_type === 'oracle';
    const dbNameLabel = isOracle ? "Service Name / SID" : "Nome do Banco";
    const schemaPlaceholder = isOracle ? "USUARIO (Schema)" : "public";
    const urlPlaceholder = isOracle ? "jdbc:oracle:thin:@host:1521/service_name" : "postgresql://user:pass@host:port/db";

    return (
        <>
            <Grid item xs={12}><Divider sx={{my: 1}} /><MDTypography variant="h6" fontWeight="medium">Banco de Dados</MDTypography></Grid>
            <Grid item xs={12}>
                <Autocomplete options={databaseTypeOptions} value={formData.db_type || null} onChange={(e, nv) => handleAutocompleteChange("db_type", nv)} renderInput={(params) => <MDInput {...params} label="Tipo" />} fullWidth />
            </Grid>
            <Grid item xs={12}>
                <FormControl component="fieldset">
                    <RadioGroup row name="db_connection_type" value={formData.db_connection_type} onChange={handleInputChange}>
                    <FormControlLabel value="HOST" control={<Radio />} label={<MDTypography variant="body2">Host</MDTypography>} />
                    <FormControlLabel value="URL" control={<Radio />} label={<MDTypography variant="body2">URL</MDTypography>} />
                    </RadioGroup>
                </FormControl>
            </Grid>
            {formData.db_connection_type === 'HOST' ? (
                <>
                    <Grid item xs={12} md={8}><MDInput label="Host" name="db_host" value={formData.db_host} onChange={handleInputChange} fullWidth /></Grid>
                    <Grid item xs={12} md={4}><MDInput label="Porta" name="db_port" value={formData.db_port} onChange={handleInputChange} fullWidth /></Grid>
                    <Grid item xs={12} md={6}><MDInput label={dbNameLabel} name="db_name" value={formData.db_name} onChange={handleInputChange} fullWidth /></Grid>
                    <Grid item xs={12} md={6}><MDInput label="User" name="db_user" value={formData.db_user} onChange={handleInputChange} fullWidth /></Grid>
                    <Grid item xs={12}><MDInput label="Senha" name="db_password" value={formData.db_password} type="password" onChange={handleInputChange} fullWidth /></Grid>
                </>
            ) : (
                <>
                    <Grid item xs={12}><MDInput label="URL" name="db_url" value={formData.db_url} onChange={handleInputChange} fullWidth placeholder={urlPlaceholder} /></Grid>
                    {isOracle && (
                        <>
                            <Grid item xs={6}><MDInput label="User" name="db_user" value={formData.db_user} onChange={handleInputChange} fullWidth /></Grid>
                            <Grid item xs={6}><MDInput label="Senha" name="db_password" value={formData.db_password} type="password" onChange={handleInputChange} fullWidth /></Grid>
                        </>
                    )}
                </>
            )}
            <Grid item xs={12}><MDInput label="Schema" name="db_schema" value={formData.db_schema} onChange={handleInputChange} fullWidth placeholder={schemaPlaceholder} /></Grid>
        </>
      );
  };

  const renderStep = () => {
    if (step === 1) {
      return (
        <>
            <Grid container spacing={3}>
                <Grid item xs={12}><MDInput label="Nome" name="name" value={formData.name} onChange={handleInputChange} fullWidth autoFocus /></Grid>
                <Grid item xs={12}><MDInput label="Descrição" name="description" value={formData.description} onChange={handleInputChange} fullWidth multiline rows={3} /></Grid>
            </Grid>
            <Collapse in={!!formData.saveError}><MDAlert color="error" sx={{ mt: 2 }}><MDTypography variant="caption" color="white">{formData.saveError}</MDTypography></MDAlert></Collapse>
            <MDBox mt={4} display="flex" justifyContent="flex-end">
                <MDButton variant="gradient" color="secondary" onClick={onClose} sx={{ mr: 2 }}>Cancelar</MDButton>
                <MDButton variant="gradient" color="info" onClick={handleNextStep} disabled={!formData.name}>Próximo</MDButton>
            </MDBox>
        </>
      );
    }
    
    if (step === 2) {
      const showDbFields = formData.tipo_fonte_contas === 'DATABASE' || formData.tipo_fonte_recursos === 'DATABASE';
      const showCsvOptions = formData.tipo_fonte_contas === "CSV" || formData.tipo_fonte_recursos === "CSV";
      const showApiOptions = formData.tipo_fonte_contas === "API" || formData.tipo_fonte_recursos === "API";

      return (
        <>
            <Grid container spacing={3}>
                {/* --- Config Contas --- */}
                <Grid item xs={12}>
                    <MDTypography variant="h6" fontWeight="medium" mb={1}>Fonte de Contas</MDTypography>
                    <Autocomplete options={tipoFonteSistemaOptions} value={formData.tipo_fonte_contas || null} onChange={(e, nv) => handleAutocompleteChange("tipo_fonte_contas", nv)} renderInput={(params) => <MDInput {...params} label="Tipo" />} fullWidth />
                    
                    {formData.tipo_fonte_contas === "CSV" && <MDInput label="Diretório de Contas" name="diretorio_contas" value={formData.diretorio_contas} onChange={handleInputChange} fullWidth sx={{ mt: 2 }} placeholder="/app/files/acc.csv" />}
                    {formData.tipo_fonte_contas === "DATABASE" && <MDInput label="Tabela de Contas" name="diretorio_contas" value={formData.diretorio_contas} onChange={handleInputChange} fullWidth sx={{ mt: 2 }} placeholder="tb_contas" />}
                    {formData.tipo_fonte_contas === "API" && <MDInput label="URL Endpoint Contas" name="diretorio_contas" value={formData.diretorio_contas} onChange={handleInputChange} fullWidth sx={{ mt: 2 }} placeholder="https://api.com/users" />}
                </Grid>
                
                {/* --- Config Recursos --- */}
                <Grid item xs={12} sx={{ mt: 2 }}>
                    <MDTypography variant="h6" fontWeight="medium" mb={1}>Fonte de Recursos</MDTypography>
                    <Autocomplete options={tipoFonteSistemaOptions} value={formData.tipo_fonte_recursos || null} onChange={(e, nv) => handleAutocompleteChange("tipo_fonte_recursos", nv)} renderInput={(params) => <MDInput {...params} label="Tipo" />} fullWidth />
                    
                    {formData.tipo_fonte_recursos === "CSV" && <MDInput label="Diretório de Recursos" name="diretorio_recursos" value={formData.diretorio_recursos} onChange={handleInputChange} fullWidth sx={{ mt: 2 }} placeholder="/app/files/res.csv" />}
                    {formData.tipo_fonte_recursos === "DATABASE" && <MDInput label="Tabela de Recursos" name="diretorio_recursos" value={formData.diretorio_recursos} onChange={handleInputChange} fullWidth sx={{ mt: 2 }} placeholder="tb_recursos" />}
                    {formData.tipo_fonte_recursos === "API" && <MDInput label="URL Endpoint Recursos" name="diretorio_recursos" value={formData.diretorio_recursos} onChange={handleInputChange} fullWidth sx={{ mt: 2 }} placeholder="https://api.com/roles" />}
                </Grid>

                {/* --- API OPTIONS --- */}
                {showApiOptions && (
                   <>
                      <Grid item xs={12}><Divider sx={{my: 1}} /><MDTypography variant="h6" fontWeight="medium">Configuração API (Global)</MDTypography></Grid>
                      <Grid item xs={4}>
                          <Autocomplete options={apiMethodOptions} value={formData.api_method} onChange={(e, nv) => handleAutocompleteChange("api_method", nv)} renderInput={(params) => <MDInput {...params} label="Método" />} fullWidth />
                      </Grid>
                      <Grid item xs={8}>
                          <MDInput label="Response Path (Opcional)" name="api_response_path" value={formData.api_response_path} onChange={handleInputChange} fullWidth placeholder="data.results" helperText="Caminho para achar a lista no JSON" />
                      </Grid>
                      <Grid item xs={12}>
                          <MDInput label="Headers (JSON)" name="api_headers" value={formData.api_headers} onChange={handleInputChange} fullWidth multiline rows={3} placeholder='{"Authorization": "Bearer..."}' />
                      </Grid>
                      <Grid item xs={12}>
                          <MDInput label="Body (POST/SOAP)" name="api_body" value={formData.api_body} onChange={handleInputChange} fullWidth multiline rows={3} />
                      </Grid>
                   </>
                )}

                {/* --- CSV OPTIONS --- */}
                {showCsvOptions && (
                   <>
                      <Grid item xs={12}><Divider sx={{my: 1}} /><MDTypography variant="h6" fontWeight="medium">Configuração CSV</MDTypography></Grid>
                      <Grid item xs={6}><MDInput label="Delimitador" name="csv_delimiter" value={formData.csv_delimiter} onChange={handleInputChange} fullWidth /></Grid>
                      <Grid item xs={6}><MDInput label="Quote" name="csv_quote" value={formData.csv_quote} onChange={handleInputChange} fullWidth /></Grid>
                   </>
                )}

                {showDbFields && renderDbFields()}
            </Grid>
            
            {/* Alertas */}
            <Collapse in={formData.testStatusContas.show}><MDAlert color={formData.testStatusContas.color} sx={{ mt: 2 }}><MDTypography variant="caption" color="white">[CONTAS] {formData.testStatusContas.message}</MDTypography></MDAlert></Collapse>
            <Collapse in={formData.testStatusRecursos.show}><MDAlert color={formData.testStatusRecursos.color} sx={{ mt: 1 }}><MDTypography variant="caption" color="white">[RECURSOS] {formData.testStatusRecursos.message}</MDTypography></MDAlert></Collapse>
            <Collapse in={!!formData.saveError}><MDAlert color="error" sx={{ mt: 2 }}><MDTypography variant="caption" color="white">Erro: {formData.saveError}</MDTypography></MDAlert></Collapse>
            
            <MDBox mt={4} display="flex" justifyContent="space-between" alignItems="center">
                {!initialData && <MDButton variant="gradient" color="secondary" onClick={() => setStep(1)} disabled={isCreatingSystem}>Voltar</MDButton>}
                <MDBox ml="auto" display="flex" alignItems="center">
                    {/* Botões de Teste */}
                    <Tooltip title="Testar Fonte de Contas">
                        <MDButton variant="gradient" color="success" onClick={handleTestContas} disabled={formData.isTestingContas || isCreatingSystem} sx={{ mr: 1 }}>
                            {formData.isTestingContas ? "..." : "Testar Contas"}
                        </MDButton>
                    </Tooltip>
                    
                    <Tooltip title="Testar Fonte de Recursos">
                        <MDButton variant="gradient" color="success" onClick={handleTestRecursos} disabled={formData.isTestingRecursos || isCreatingSystem} sx={{ mr: 2 }}>
                            {formData.isTestingRecursos ? "..." : "Testar Recursos"}
                        </MDButton>
                    </Tooltip>

                    <MDButton variant="gradient" color="info" onClick={handleSave} disabled={getSaveDisabled()}>
                        {isCreatingSystem ? <CircularProgress size={20} color="inherit" /> : "Salvar"}
                    </MDButton>
                </MDBox>
            </MDBox>
        </>
      );
    }
  };
      
  return (
    <Modal open={open} onClose={onClose} sx={{ display: "grid", placeItems: "center" }}>
      <Card sx={{ width: "90%", maxWidth: "600px", overflowY: "auto", maxHeight: "90vh" }}>
        <MDBox p={3}>
          <MDTypography variant="h5">{initialData ? "Editar" : "Adicionar"} Fonte de Dados de Sistema</MDTypography>
          <MDTypography variant="caption" color="text">Origem: SISTEMA (Passo {step} de 2)</MDTypography>
        </MDBox>
        <MDBox component="form" p={3} pt={0}>
          {renderStep()}
        </MDBox>
      </Card>
    </Modal>
  );
}

SistemaDataSourceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

SistemaDataSourceModal.defaultProps = {
  initialData: null,
};

export default SistemaDataSourceModal;