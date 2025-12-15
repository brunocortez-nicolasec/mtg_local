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
import Switch from "@mui/material/Switch";
import Divider from "@mui/material/Divider";
import Icon from "@mui/material/Icon";
import CircularProgress from "@mui/material/CircularProgress";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";

const tipoFonteOptions = ["CSV", "DATABASE", "API"]; 
const databaseTypeOptions = ["postgres", "mysql", "oracle", "sqlserver"]; 
const apiMethodOptions = ["GET", "POST"]; 
const authTypeOptions = ["No Auth", "Basic Auth", "Bearer Token"]; 

function RHDataSourceModal({ open, onClose, onSave, initialData }) {
  
  const defaultState = {
    name: "",
    origem: "RH", 
    description: "",
    type_datasource: "CSV",
    
    // Campos CSV
    diretorio_hr: "", 
    csv_delimiter: ",", 
    csv_quote: "\"", 
    
    // Campos de Banco de Dados
    db_type: "postgres", 
    db_connection_type: "HOST",
    db_host: "",
    db_port: "5432",
    db_name: "",
    db_user: "",
    db_password: "",
    db_url: "",
    db_schema: "public",
    db_table: "",
    
    // --- API ---
    api_subtype: "REST", 
    api_url: "",
    api_method: "GET",
    api_headers: '{"Content-Type": "application/json"}', 
    api_body: "",
    api_response_path: "",
    
    // --- AUTH ---
    api_auth_type: "No Auth",
    api_auth_user: "",
    api_auth_password: "",
    api_auth_token: "",

    // --- AUTH DINÂMICA (OAuth2) ---
    auth_is_dynamic: false,
    auth_token_url: "",
    auth_client_id: "",
    auth_client_secret: "",
    auth_grant_type: "client_credentials",
    auth_scope: "",
  };

  const [formData, setFormData] = useState(defaultState);
  const [testStatus, setTestStatus] = useState({ show: false, color: "info", message: "" });
  const [isTesting, setIsTesting] = useState(false);
  const [isFetchingToken, setIsFetchingToken] = useState(false);
  
  const API_URL = process.env.REACT_APP_API_URL;

  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });
  
  useEffect(() => {
    if (open) {
      setTestStatus({ show: false });
      if (initialData) {
        const config = initialData.hrConfig || {};

        // Inferência REST/SOAP
        let inferredSubtype = "REST";
        const bodyContent = config.api_body || "";
        const headersContent = config.api_headers ? JSON.stringify(config.api_headers).toLowerCase() : "";
        
        if (bodyContent.includes("soap:Envelope") || headersContent.includes("text/xml") || headersContent.includes("soapaction")) {
            inferredSubtype = "SOAP";
        }
        
        // Inferência de Auth
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
            type_datasource: initialData.type_datasource || "CSV",
            
            // CSV
            diretorio_hr: config.diretorio_hr || "",
            csv_delimiter: config.csv_delimiter || ",", 
            csv_quote: config.csv_quote || "\"",       
            
            // DB
            db_type: config.db_type || "postgres",
            db_connection_type: config.db_connection_type || "HOST",
            db_host: config.db_host || "",
            db_port: config.db_port || (config.db_type === 'oracle' ? "1521" : "5432"),
            db_name: config.db_name || "",
            db_user: config.db_user || "",
            db_password: config.db_password || "",
            db_url: config.db_url || "",
            db_schema: config.db_schema || (config.db_type === 'oracle' ? "" : "public"),
            db_table: config.db_table || "",

            // API
            api_subtype: inferredSubtype,
            api_url: config.api_url || "",
            api_method: config.api_method || "GET",
            api_headers: config.api_headers ? JSON.stringify(config.api_headers, null, 2) : '{"Content-Type": "application/json"}',
            api_body: config.api_body || "",
            api_response_path: config.api_response_path || "",
            
            // AUTH
            api_auth_type: inferredAuthType,
            api_auth_token: inferredToken,

            // Dinamica
            auth_is_dynamic: config.auth_is_dynamic || false,
            auth_token_url: config.auth_token_url || "",
            auth_client_id: config.auth_client_id || "",
            auth_client_secret: config.auth_client_secret || "",
            auth_grant_type: config.auth_grant_type || "client_credentials",
            auth_scope: config.auth_scope || "",
        });
        
      } else {
        setFormData(defaultState);
      }
    }
  }, [initialData, open]);

  useEffect(() => {
    setTestStatus({ show: false });
    setIsTesting(false);
  }, [formData.type_datasource, formData.db_connection_type]);

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

  const handleFetchToken = async () => {
      if (!formData.auth_token_url || !formData.auth_client_id) {
          setTestStatus({ show: true, color: "warning", message: "Preencha a URL de Token e o Client ID." });
          return;
      }

      setIsFetchingToken(true);
      setTestStatus({ show: false, message: "" }); 

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
                   setFormData(prev => ({ ...prev, api_auth_token: token }));
                   setTestStatus({ show: true, color: "success", message: "Token obtido com sucesso! Campo atualizado." });
               } else {
                   setTestStatus({ show: true, color: "warning", message: "Resposta recebida, mas não foi possível extrair 'access_token' automaticamente." });
               }
          } else {
               setTestStatus({ show: true, color: "warning", message: "Token gerado, mas não foi possível extrair automaticamente. Verifique o log." });
          }

      } catch (error) {
          console.error("Erro ao buscar token:", error);
          const msg = error.response?.data?.message || error.message;
          setTestStatus({ show: true, color: "error", message: `Erro ao obter token: ${msg}` });
      } finally {
          setIsFetchingToken(false);
      }
  };

  const handleTestAPI = async () => {
    if (!formData.api_url) {
        setTestStatus({ show: true, color: "warning", message: "A URL da API é obrigatória." });
        return;
    }
    const finalHeaders = getFinalHeaders();

    setIsTesting(true);
    setTestStatus({ show: true, color: "info", message: "Enviando requisição..." });

    try {
        const response = await api.post("/datasources/test-api", {
            apiUrl: formData.api_url,
            method: formData.api_method,
            headers: finalHeaders,
            body: formData.api_body,
            responsePath: formData.api_response_path
        });

        let successMsg = response.data.message;
        if (response.data.detectedColumns?.length > 0) {
            successMsg += ` Colunas: [${response.data.detectedColumns.slice(0, 5).join(", ")}...]`;
        }
        setTestStatus({ show: true, color: "success", message: successMsg });
    } catch (error) {
        const message = error.response?.data?.message || error.message;
        setTestStatus({ show: true, color: "error", message: `Falha na API: ${message}` });
    } finally {
        setIsTesting(false);
    }
  };
  
  const handleTestCSV = async () => {
    if (!formData.diretorio_hr) {
      setTestStatus({ show: true, color: "warning", message: "Por favor, insira o diretório CSV para testar." });
      return;
    }
    setIsTesting(true);
    setTestStatus({ show: true, color: "info", message: "Testando leitura do arquivo CSV..." });

    try {
      const response = await api.post("/datasources/test-csv", { 
          diretorio: formData.diretorio_hr,
          delimiter: formData.csv_delimiter,
          quote: formData.csv_quote
      });
      const colsCount = response.data.detectedColumns || 0;
      const headerPreview = response.data.header.substring(0, 50);

      setTestStatus({ show: true, color: "success", message: `Sucesso! Encontrado (${colsCount} colunas). Header: ${headerPreview}...` });
    } catch (error) {
      const message = error.response?.data?.message || "Erro desconhecido.";
      setTestStatus({ show: true, color: "error", message: `Falha na conexão CSV: ${message}` });
    } finally {
      setIsTesting(false);
    }
  };
  
  const handleTestDatabase = async () => {
    if (!formData.db_table) {
          setTestStatus({ show: true, color: "warning", message: "Informe o nome da Tabela para validar." });
          return;
    }
    setIsTesting(true);
    setTestStatus({ show: true, color: "info", message: "Conectando ao Banco..." });
    
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
            table: formData.db_table
        });
        
        let successMsg = response.data.message;
        if (response.data.columns && response.data.columns.length > 0) {
              const colList = response.data.columns.slice(0, 5).join(", "); 
              const extra = response.data.columns.length > 5 ? `... (+${response.data.columns.length - 5})` : "";
              successMsg += ` Colunas: [${colList}${extra}]`;
        }
        setTestStatus({ show: true, color: "success", message: successMsg });
    } catch (error) {
        const message = error.response?.data?.message || "Erro desconhecido.";
        setTestStatus({ show: true, color: "error", message: `Falha na conexão DB: ${message}` });
    } finally {
        setIsTesting(false);
    }
  };
  
  const handleTestConnection = () => {
      if (formData.type_datasource === "CSV") return handleTestCSV();
      if (formData.type_datasource === "DATABASE") return handleTestDatabase();
      if (formData.type_datasource === "API") return handleTestAPI();
  }

  const getSaveDisabled = () => {
    if (!formData.name) return true;
    if (isTesting) return true;
    if (formData.type_datasource !== null) {
      return testStatus.color !== "success";
    }
    return false;
  };
  
  const handleSave = () => {
    const finalHeaders = getFinalHeaders();

    const payload = {
        name: formData.name,
        origem: "RH",
        description: formData.description,
        databaseType: formData.type_datasource, 
        diretorio: formData.diretorio_hr, 
        
        type_datasource: formData.type_datasource,
        diretorio_hr: formData.diretorio_hr,
        
        csv_delimiter: formData.csv_delimiter,
        csv_quote: formData.csv_quote,

        db_connection_type: formData.db_connection_type,
        db_host: formData.db_host,
        db_port: formData.db_port,
        db_name: formData.db_name,
        db_user: formData.db_user,
        db_password: formData.db_password,
        db_type: formData.db_type,
        db_url: formData.db_url,
        db_schema: formData.db_schema,
        db_table: formData.db_table,

        // API
        api_url: formData.api_url,
        api_method: formData.api_method,
        api_headers: finalHeaders,
        api_body: formData.api_body,
        api_response_path: formData.api_response_path,

        // AUTH DINAMICA
        auth_is_dynamic: formData.auth_is_dynamic,
        auth_token_url: formData.auth_token_url,
        auth_client_id: formData.auth_client_id,
        auth_client_secret: formData.auth_client_secret,
        auth_grant_type: formData.auth_grant_type,
        auth_scope: formData.auth_scope
    };
    onSave(payload); 
  };
  
  const renderConnectionFields = () => {
    switch (formData.type_datasource) {
        case "CSV":
            return (
                <>
                    <Grid item xs={12}>
                        <MDInput label="Diretório (Caminho no Servidor)" name="diretorio_hr" value={formData.diretorio_hr} onChange={handleInputChange} fullWidth placeholder="/app/files/rh_data.csv" />
                    </Grid>
                    <Grid item xs={6}>
                        <MDInput label="Delimitador" name="csv_delimiter" value={formData.csv_delimiter} onChange={handleInputChange} fullWidth placeholder="Ex: , ou ;" helperText="Padrão: vírgula (,)" />
                    </Grid>
                    <Grid item xs={6}>
                        <MDInput label="Caractere de Citação" name="csv_quote" value={formData.csv_quote} onChange={handleInputChange} fullWidth placeholder='Ex: " ou' helperText='Padrão: aspas duplas (")' />
                    </Grid>
                </>
            );
        case "DATABASE":
            const isOracle = formData.db_type === 'oracle';
            const dbNameLabel = isOracle ? "Service Name / SID" : "Nome do Banco";
            const schemaPlaceholder = isOracle ? "USUARIO (Schema)" : "public";
            
            return (
                <>
                    <Grid item xs={12}>
                      <Autocomplete
                        options={databaseTypeOptions}
                        value={formData.db_type || null}
                        onChange={(e, nv) => handleAutocompleteChange("db_type", nv)}
                        renderInput={(params) => <MDInput {...params} label="Tipo de Banco" />}
                        fullWidth
                      />
                    </Grid>
                    
                    <Grid item xs={12}>
                        <FormControl component="fieldset">
                          <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1 }}>Método de Conexão</FormLabel>
                          <RadioGroup row name="db_connection_type" value={formData.db_connection_type} onChange={handleInputChange}>
                            <FormControlLabel value="HOST" control={<Radio />} label={<MDTypography variant="body2">Host / Porta</MDTypography>} />
                            <FormControlLabel value="URL" control={<Radio />} label={<MDTypography variant="body2">URL de Conexão</MDTypography>} />
                          </RadioGroup>
                        </FormControl>
                    </Grid>

                    {formData.db_connection_type === 'HOST' ? (
                        <>
                            <Grid item xs={12} md={8}><MDInput label="Host" name="db_host" value={formData.db_host} onChange={handleInputChange} fullWidth placeholder="localhost" /></Grid>
                            <Grid item xs={12} md={4}><MDInput label="Porta" name="db_port" value={formData.db_port} onChange={handleInputChange} fullWidth placeholder="5432" /></Grid>
                            <Grid item xs={12} md={6}><MDInput label={dbNameLabel} name="db_name" value={formData.db_name} onChange={handleInputChange} fullWidth /></Grid>
                            <Grid item xs={12} md={6}><MDInput label="Usuário" name="db_user" value={formData.db_user} onChange={handleInputChange} fullWidth /></Grid>
                            <Grid item xs={12}><MDInput label="Senha" name="db_password" value={formData.db_password} type="password" onChange={handleInputChange} fullWidth /></Grid>
                        </>
                    ) : (
                        <>
                            <Grid item xs={12}>
                                <MDInput 
                                    label="URL de Conexão (Connect String)" 
                                    name="db_url" 
                                    value={formData.db_url} 
                                    onChange={handleInputChange} 
                                    fullWidth 
                                    placeholder={isOracle ? "jdbc:oracle:thin:@host:1521/service_name" : "postgresql://user:pass@host:port/db"}
                                    helperText={isOracle ? "Para Oracle, use o formato Easy Connect (host:port/service)" : ""}
                                />
                            </Grid>
                            {isOracle && (
                                <>
                                    <Grid item xs={12} md={6}><MDInput label="Usuário" name="db_user" value={formData.db_user} onChange={handleInputChange} fullWidth /></Grid>
                                    <Grid item xs={12} md={6}><MDInput label="Senha" name="db_password" value={formData.db_password} type="password" onChange={handleInputChange} fullWidth /></Grid>
                                </>
                            )}
                        </>
                    )}

                    <Grid item xs={12}>
                         <MDBox mt={1} mb={1}><MDTypography variant="caption" fontWeight="bold">Alvo da Importação</MDTypography></MDBox>
                    </Grid>
                    <Grid item xs={12} md={4}><MDInput label="Schema" name="db_schema" value={formData.db_schema} onChange={handleInputChange} fullWidth placeholder={schemaPlaceholder} /></Grid>
                    <Grid item xs={12} md={8}><MDInput label="Tabela Principal" name="db_table" value={formData.db_table} onChange={handleInputChange} fullWidth placeholder="Ex: tb_funcionarios" required error={!formData.db_table} /></Grid>
                </>
            );
        case "API":
            return (
                <>
                    {/* SELEÇÃO REST vs SOAP */}
                    <Grid item xs={12}>
                        <FormControl component="fieldset">
                          <FormLabel component="legend" sx={{ fontSize: '0.875rem', mb: 1, color: 'text.main' }}>Tipo de API</FormLabel>
                          <RadioGroup row name="api_subtype" value={formData.api_subtype} onChange={handleApiSubtypeChange}>
                            <FormControlLabel value="REST" control={<Radio />} label={<MDTypography variant="body2" fontWeight={formData.api_subtype === 'REST' ? "bold" : "regular"}>REST (JSON)</MDTypography>} />
                            <FormControlLabel value="SOAP" control={<Radio />} label={<MDTypography variant="body2" fontWeight={formData.api_subtype === 'SOAP' ? "bold" : "regular"}>SOAP (XML)</MDTypography>} />
                          </RadioGroup>
                        </FormControl>
                    </Grid>

                    <Grid item xs={12} md={3}>
                      <Autocomplete
                        options={apiMethodOptions}
                        value={formData.api_method || "GET"}
                        onChange={(e, nv) => handleAutocompleteChange("api_method", nv)}
                        renderInput={(params) => <MDInput {...params} label="Método" />}
                        fullWidth
                        disabled={formData.api_subtype === 'SOAP'} 
                      />
                    </Grid>
                    <Grid item xs={12} md={9}>
                        <MDInput label="URL do Endpoint" name="api_url" value={formData.api_url} onChange={handleInputChange} fullWidth placeholder={formData.api_subtype === 'SOAP' ? "https://api.empresa.com/ws/service.asmx" : "https://api.sistema.com/users"} />
                    </Grid>
                    
                    {/* --- AUTHENTICATION (REST) --- */}
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

                             {/* --- OAUTH2 / DYNAMIC TOKEN (LIMPO + CORREÇÃO DE ALINHAMENTO) --- */}
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
                                            disabled={isFetchingToken}
                                         >
                                             {isFetchingToken ? <CircularProgress size={16} /> : "Gerar Token"}
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
                            helperText="Opcional. Caminho para achar a lista de usuários na resposta."
                        />
                    </Grid>
                </>
            );
        default:
            return null;
    }
  };

  return (
    <Modal open={open} onClose={onClose} sx={{ display: "grid", placeItems: "center" }}>
      <Card sx={{ width: "90%", maxWidth: "600px", overflowY: "auto", maxHeight: "90vh" }}>
        <MDBox p={3}>
          <MDTypography variant="h5">{initialData ? "Editar" : "Adicionar"} Fonte de Dados RH</MDTypography>
          <MDTypography variant="caption" color="text">Origem: RH (Fonte Autoritativa)</MDTypography>
        </MDBox>
        <MDBox component="form" p={3} pt={0}>
            <Grid container spacing={3}>
                <Grid item xs={12}>
                    <MDInput label="Nome" name="name" value={formData.name} onChange={handleInputChange} fullWidth autoFocus />
                </Grid>
                
                <Grid item xs={12}>
                    <Autocomplete
                        options={tipoFonteOptions}
                        value={formData.type_datasource || null}
                        onChange={(e, nv) => handleAutocompleteChange("type_datasource", nv)}
                        renderInput={(params) => <MDInput {...params} label="Tipo de Conexão" />}
                        fullWidth
                    />
                </Grid>
                
                {renderConnectionFields()}
                
                <Grid item xs={12}>
                    <MDInput label="Descrição (Opcional)" name="description" value={formData.description} onChange={handleInputChange} fullWidth multiline rows={3} />
                </Grid>
            </Grid>
            
            <Collapse in={testStatus.show}>
                <MDAlert color={testStatus.color} sx={{ mt: 2, mb: 0 }}>
                    <MDTypography variant="caption" color="white" sx={{whiteSpace: 'pre-wrap', wordBreak: 'break-word'}}>{testStatus.message}</MDTypography>
                </MDAlert>
            </Collapse>
            
            <MDBox mt={4} display="flex" justifyContent="flex-end">
                <MDButton variant="gradient" color="secondary" onClick={onClose} sx={{ mr: 2 }}>Cancelar</MDButton>
                
                {formData.type_datasource && (
                    <Tooltip title="Testar a conexão com a fonte de dados">
                        <MDButton variant="gradient" color="success" onClick={handleTestConnection} disabled={isTesting} sx={{ mr: 2 }}>
                            {isTesting ? "Testando..." : "Testar Conexão"}
                        </MDButton>
                    </Tooltip>
                )}
                
                <MDButton variant="gradient" color="info" onClick={handleSave} disabled={getSaveDisabled()}>
                    Salvar
                </MDButton>
            </MDBox>
        </MDBox>
      </Card>
    </Modal>
  );
}

RHDataSourceModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

RHDataSourceModal.defaultProps = {
  initialData: null,
};

export default RHDataSourceModal;