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
import Icon from "@mui/material/Icon";
import Switch from "@mui/material/Switch";
import CircularProgress from "@mui/material/CircularProgress"; 

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";

const tipoFonteSistemaOptions = ["CSV", "DATABASE", "API"];
const databaseTypeOptions = ["postgres", "mysql", "oracle", "sqlserver"]; 
const apiMethodOptions = ["GET", "POST", "PUT", "DELETE"]; 
const authTypeOptions = ["No Auth", "Basic Auth", "Bearer Token"];

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

    // --- API ---
    api_subtype: "REST", 
    api_method: "GET",
    api_headers: '{"Content-Type": "application/json"}',
    api_body: "",
    api_response_path: "",
    
    // --- AUTH ---
    api_auth_type: "No Auth",
    api_auth_user: "",
    api_auth_password: "",
    api_auth_token: "",

    // --- AUTH DINÂMICA ---
    auth_is_dynamic: false,
    auth_token_url: "",
    auth_client_id: "",
    auth_client_secret: "",
    auth_grant_type: "client_credentials",
    auth_scope: "",

    // Status de Teste
    testStatusContas: { show: false, color: "info", message: "" },
    isTestingContas: false,
    testStatusRecursos: { show: false, color: "info", message: "" },
    isTestingRecursos: false,
    isFetchingToken: false,
    
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
        
        // Inferência REST/SOAP
        let inferredSubtype = "REST";
        const bodyContent = config.api_body || "";
        const headersContent = config.api_headers ? JSON.stringify(config.api_headers).toLowerCase() : "";
        if (bodyContent.includes("soap:Envelope") || headersContent.includes("text/xml") || headersContent.includes("soapaction")) {
            inferredSubtype = "SOAP";
        }
        
        // Inferência Auth
        let inferredAuthType = "No Auth";
        let inferredToken = "";
        if (config.api_headers && config.api_headers.Authorization) {
            if (config.api_headers.Authorization.startsWith("Bearer ")) {
                inferredAuthType = "Bearer Token";
                inferredToken = config.api_headers.Authorization.replace("Bearer ", "");
            } else if (config.api_headers.Authorization.startsWith("Basic ")) {
                inferredAuthType = "Basic Auth";
            }
        }

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
            api_subtype: inferredSubtype,
            api_method: config.api_method || "GET",
            api_headers: config.api_headers ? JSON.stringify(config.api_headers, null, 2) : '{"Content-Type": "application/json"}',
            api_body: config.api_body || "",
            api_response_path: config.api_response_path || "",
            
            // AUTH
            api_auth_type: inferredAuthType,
            api_auth_token: inferredToken,

            // DYNAMIC AUTH
            auth_is_dynamic: config.auth_is_dynamic || false,
            auth_token_url: config.auth_token_url || "",
            auth_client_id: config.auth_client_id || "",
            auth_client_secret: config.auth_client_secret || "",
            auth_grant_type: config.auth_grant_type || "client_credentials",
            auth_scope: config.auth_scope || "",
            
            testStatusContas: { show: false, color: "success" }, 
            testStatusRecursos: { show: false, color: "success" }, 
        });
        
      } else {
        setStep(1); 
        setFormData(defaultState);
      }
    }
  }, [initialData, open]);

  // Limpeza de status
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
    formData.api_headers, formData.api_method, formData.api_auth_type
  ]);

  useEffect(() => {
     setFormData(prev => ({ ...prev, testStatusContas: { show: false, color: "info", message: "" } }));
  }, [formData.tipo_fonte_contas, formData.diretorio_contas]);

  useEffect(() => {
     setFormData(prev => ({ ...prev, testStatusRecursos: { show: false, color: "info", message: "" } }));
  }, [formData.tipo_fonte_recursos, formData.diretorio_recursos]);


  const handleInputChange = (e) => {
    const { name, value, checked, type } = e.target;
    setFormData((prev) => ({ 
        ...prev, 
        [name]: type === 'checkbox' ? checked : value 
    }));
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

  const handleApiSubtypeChange = (e) => {
      const subtype = e.target.value;
      const isSoap = subtype === "SOAP";

      setFormData(prev => ({
          ...prev,
          api_subtype: subtype,
          api_method: isSoap ? "POST" : "GET",
          api_headers: isSoap 
            ? '{\n  "Content-Type": "text/xml",\n  "SOAPAction": "http://tempuri.org/Action"\n}' 
            : '{\n  "Content-Type": "application/json"\n}',
          api_body: isSoap 
            ? '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">\n  <soap:Body>\n    \n  </soap:Body>\n</soap:Envelope>' 
            : "",
          api_response_path: ""
      }));
  };

  const getFinalHeaders = () => {
      let headers = {};
      try {
          if (formData.api_headers) headers = JSON.parse(formData.api_headers);
      } catch (e) {
          console.error("Erro ao parsear headers manuais");
      }

      if (formData.api_auth_type === "Bearer Token" && formData.api_auth_token) {
          headers["Authorization"] = `Bearer ${formData.api_auth_token}`;
      } else if (formData.api_auth_type === "Basic Auth" && formData.api_auth_user && formData.api_auth_password) {
          const token = btoa(`${formData.api_auth_user}:${formData.api_auth_password}`);
          headers["Authorization"] = `Basic ${token}`;
      }
      return headers;
  };
  
  const handleNextStep = () => {
    if (!formData.name) return;
    setStep(2);
  };

  // --- Função para Buscar Token Dinamicamente ---
  const handleFetchToken = async () => {
      if (!formData.auth_token_url || !formData.auth_client_id) {
          // Usa o status de contas para feedback genérico se não tiver um específico
          setFormData(prev => ({ ...prev, testStatusContas: { show: true, color: "warning", message: "Preencha a URL e Client ID." } }));
          return;
      }

      setFormData(prev => ({ ...prev, isFetchingToken: true }));

      try {
          const payload = {
              client_id: formData.auth_client_id,
              client_secret: formData.auth_client_secret,
              grant_type: formData.auth_grant_type,
              scope: formData.auth_scope
          };

          const response = await api.post("/datasources/test-api", {
              apiUrl: formData.auth_token_url,
              method: 'POST',
              headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
              body: new URLSearchParams(payload).toString(), 
              responsePath: "" 
          });

          if (response.data && response.data.fullResponse) {
               const token = response.data.fullResponse.access_token || response.data.fullResponse.token;
               if (token) {
                   setFormData(prev => ({ 
                       ...prev, 
                       api_auth_token: token,
                       testStatusContas: { show: true, color: "success", message: "Token gerado com sucesso!" }
                   }));
               } else {
                   setFormData(prev => ({ ...prev, testStatusContas: { show: true, color: "warning", message: "Token não encontrado na resposta." } }));
               }
          }

      } catch (error) {
          const msg = error.response?.data?.message || error.message;
          setFormData(prev => ({ ...prev, testStatusContas: { show: true, color: "error", message: `Erro Token: ${msg}` } }));
      } finally {
          setFormData(prev => ({ ...prev, isFetchingToken: false }));
      }
  };

  // --- Testes de Conexão ---
  const handleTestAPI = async (endpointUrl, setTesting, setStatusState) => {
    if (!endpointUrl) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Informe a URL do Endpoint." } }));
        return;
    }

    const finalHeaders = getFinalHeaders(); 

    setFormData(prev => ({ ...prev, [setTesting]: true, [setStatusState]: { show: true, color: "info", message: "Enviando requisição API..." } }));

    try {
        const response = await api.post("/datasources/test-api", {
            apiUrl: endpointUrl, 
            method: formData.api_method,
            headers: finalHeaders, 
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

  const handleTestCSV = async (diretorio, setTesting, setStatusState) => {
    if (!diretorio) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Insira o diretório." } }));
        return;
    }
    setFormData(prev => ({ ...prev, [setTesting]: true, [setStatusState]: { show: true, color: "info", message: "Testando arquivo..." } }));
    try {
      const response = await api.post("/datasources/test-csv", { diretorio, delimiter: formData.csv_delimiter, quote: formData.csv_quote });
      const cols = response.data.detectedColumns || 0;
      setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "success", message: `Sucesso! (${cols} colunas).` } }));
    } catch (e) {
      setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "error", message: e.message } }));
    } finally {
      setFormData(prev => ({ ...prev, [setTesting]: false }));
    }
  };

  const handleTestDB = async (tableName, setTesting, setStatusState) => {
    if (!tableName) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "warning", message: "Informe a Tabela." } }));
        return;
    }
    setFormData(prev => ({ ...prev, [setTesting]: true, [setStatusState]: { show: true, color: "info", message: "Conectando BD..." } }));
    try {
        const response = await api.post("/datasources/test-db", { ...formData, connectionType: formData.db_connection_type, host: formData.db_host, port: formData.db_port, user: formData.db_user, password: formData.db_password, database: formData.db_name, url: formData.db_url, type: formData.db_type, schema: formData.db_schema, table: tableName });
        const cols = response.data.columns?.length || 0;
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "success", message: `OK! Tabela encontrada (${cols} cols).` } }));
    } catch (e) {
        setFormData(prev => ({ ...prev, [setStatusState]: { show: true, color: "error", message: e.message } }));
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
      return false;
  };
  
  const handleSave = async () => {
    setFormData(prev => ({ ...prev, saveError: null }));
    setIsCreatingSystem(true);

    const finalHeaders = getFinalHeaders();

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
            diretorio_contas: formData.diretorio_contas, 
            tipo_fonte_recursos: formData.tipo_fonte_recursos,
            diretorio_recursos: formData.diretorio_recursos, 

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

            api_method: formData.api_method,
            api_headers: finalHeaders,
            api_body: formData.api_body,
            api_response_path: formData.api_response_path,

            auth_is_dynamic: formData.auth_is_dynamic,
            auth_token_url: formData.auth_token_url,
            auth_client_id: formData.auth_client_id,
            auth_client_secret: formData.auth_client_secret,
            auth_grant_type: formData.auth_grant_type,
            auth_scope: formData.auth_scope
        };

        await onSave(payload); 
        
    } catch (error) {
        console.error("Erro no fluxo de salvamento:", error);
        const message = error.response?.data?.message || "Erro ao salvar.";
        setFormData(prev => ({ ...prev, saveError: message }));
    } finally {
        setIsCreatingSystem(false);
    }
  };
  
  // Renderizadores de Campos
  const renderCommonApiFields = () => (
      <>
        <Grid item xs={12}>
            <FormControl component="fieldset">
              <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1, color: 'text.main' }}>Tipo de API</FormLabel>
              <RadioGroup row name="api_subtype" value={formData.api_subtype} onChange={handleApiSubtypeChange}>
                <FormControlLabel value="REST" control={<Radio />} label={<MDTypography variant="body2" fontWeight={formData.api_subtype === 'REST' ? "bold" : "regular"}>REST (JSON)</MDTypography>} />
                <FormControlLabel value="SOAP" control={<Radio />} label={<MDTypography variant="body2" fontWeight={formData.api_subtype === 'SOAP' ? "bold" : "regular"}>SOAP (XML)</MDTypography>} />
              </RadioGroup>
            </FormControl>
        </Grid>

        <Grid item xs={12} md={4}>
            <Autocomplete
            options={apiMethodOptions}
            value={formData.api_method || "GET"}
            onChange={(e, nv) => handleAutocompleteChange("api_method", nv)}
            renderInput={(params) => <MDInput {...params} label="Método" />}
            fullWidth
            disabled={formData.api_subtype === 'SOAP'} 
            />
        </Grid>
        
        {/* --- AUTENTICAÇÃO REST --- */}
        {formData.api_subtype === 'REST' && (
            <>
                <Grid item xs={12}>
                    <MDTypography variant="caption" fontWeight="bold" color="text" textTransform="uppercase">Autenticação</MDTypography>
                </Grid>
                
                <Grid item xs={12} md={4}>
                    <Autocomplete
                    options={authTypeOptions}
                    value={formData.api_auth_type}
                    onChange={(e, nv) => handleAutocompleteChange("api_auth_type", nv)}
                    renderInput={(params) => <MDInput {...params} label="Tipo de Autenticação" />}
                    fullWidth
                    disableClearable
                    />
                </Grid>
                
                {formData.api_auth_type === 'Basic Auth' && (
                    <>
                        <Grid item xs={12} md={4}>
                        <MDInput label="Usuário" name="api_auth_user" value={formData.api_auth_user} onChange={handleInputChange} fullWidth />
                        </Grid>
                        <Grid item xs={12} md={4}>
                        <MDInput label="Senha" name="api_auth_password" value={formData.api_auth_password} type="password" onChange={handleInputChange} fullWidth />
                        </Grid>
                    </>
                )}
                
                {formData.api_auth_type === 'Bearer Token' && (
                    <Grid item xs={12} md={8}>
                    <MDInput 
                        label="Token (Bearer)" 
                        name="api_auth_token" 
                        value={formData.api_auth_token} 
                        onChange={handleInputChange} 
                        fullWidth 
                        placeholder="eyJhbGciOiJIUz..." 
                        InputProps={{
                            endAdornment: (
                                <Tooltip title="Ativar requisição automática de token (Bearer)">
                                    <Switch checked={formData.auth_is_dynamic} onChange={(e) => handleInputChange({ target: { name: 'auth_is_dynamic', value: null, checked: e.target.checked, type: 'checkbox' } })} />
                                </Tooltip>
                            )
                        }}
                        helperText={formData.auth_is_dynamic ? "Modo Dinâmico: Token será gerado automaticamente." : ""}
                    />
                    </Grid>
                )}

                {/* --- OAUTH2 / DYNAMIC TOKEN (LIMPO) --- */}
                {formData.api_auth_type === 'Bearer Token' && formData.auth_is_dynamic && (
                    <>
                        <Grid item xs={12}>
                            <Divider sx={{my: 1}} />
                            <MDBox display="flex" alignItems="center">
                                <Icon color="info" sx={{ mr: 1 }}>sync</Icon>
                                <MDTypography variant="button" fontWeight="bold" color="info" textTransform="uppercase">
                                    Configuração de Token (Bearer)
                                </MDTypography>
                            </MDBox>
                        </Grid>
                        
                        <Grid item xs={12} md={8}>
                            <MDInput label="URL do Token" name="auth_token_url" value={formData.auth_token_url} onChange={handleInputChange} fullWidth placeholder="https://auth.provider.com/token" />
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <MDInput label="Grant Type" name="auth_grant_type" value={formData.auth_grant_type} onChange={handleInputChange} fullWidth placeholder="client_credentials" />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <MDInput label="Client ID" name="auth_client_id" value={formData.auth_client_id} onChange={handleInputChange} fullWidth />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <MDInput label="Client Secret" name="auth_client_secret" value={formData.auth_client_secret} onChange={handleInputChange} fullWidth type="password" />
                        </Grid>
                        <Grid item xs={12} md={12}>
                            <MDInput label="Scope (Opcional)" name="auth_scope" value={formData.auth_scope} onChange={handleInputChange} fullWidth placeholder="read write" />
                        </Grid>
                        <Grid item xs={12} display="flex" justifyContent="flex-end">
                            <MDButton 
                               variant="outlined" 
                               color="info" 
                               size="small" 
                               onClick={handleFetchToken}
                               disabled={formData.isFetchingToken}
                            >
                                {formData.isFetchingToken ? <CircularProgress size={16} /> : "Gerar Token"}
                            </MDButton>
                        </Grid>
                        <Grid item xs={12}><Divider sx={{my: 1}} /></Grid>
                    </>
                )}
            </>
        )}

        <Grid item xs={12}>
            <MDTypography variant="caption" fontWeight="bold" color="text" textTransform="uppercase">Configurações Avançadas</MDTypography>
        </Grid>

        <Grid item xs={12}>
            <MDInput 
                label="Headers Adicionais (JSON)" 
                name="api_headers" 
                value={formData.api_headers} 
                onChange={handleInputChange} 
                fullWidth 
                multiline 
                rows={3} 
                placeholder='{"Custom-Header": "Valor"}' 
                helperText={formData.api_auth_type !== 'No Auth' ? "O header 'Authorization' será adicionado automaticamente." : "Insira os headers em formato JSON."}
            />
        </Grid>

        <Grid item xs={12}>
            <MDInput 
                label={formData.api_subtype === 'SOAP' ? "Envelope SOAP (XML)" : "Body (JSON)"}
                name="api_body" 
                value={formData.api_body} 
                onChange={handleInputChange} 
                fullWidth 
                multiline 
                rows={5} 
                placeholder={formData.api_subtype === 'SOAP' ? "<soap:Envelope...>" : "{ 'filter': 'active' }"} 
            />
        </Grid>

        <Grid item xs={12}>
            <MDInput 
                label="Caminho dos Dados (Response Path)" 
                name="api_response_path" 
                value={formData.api_response_path} 
                onChange={handleInputChange} 
                fullWidth 
                placeholder={formData.api_subtype === 'SOAP' ? "soap:Envelope.soap:Body.GetResponse.Result" : "data.results"} 
                helperText="Opcional. Caminho para achar a lista de dados."
            />
        </Grid>
      </>
  );

  const renderDbFields = () => {
    /* (Mantido igual) */
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
                       {renderCommonApiFields()}
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