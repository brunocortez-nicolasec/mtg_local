// material-react-app/src/layouts/observabilidade/contasRecursos/components/ContasTab.js

import { useState, useEffect, useMemo } from "react";
import { useMaterialUIController } from "context";
import axios from "axios";

// @mui material components
import Icon from "@mui/material/Icon";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid"; 
import InputAdornment from "@mui/material/InputAdornment";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DataTable from "examples/Tables/DataTable";
import MDSnackbar from "components/MDSnackbar";
import MDBadge from "components/MDBadge";

function ContasTab() {
  const [controller] = useMaterialUIController();
  const { token, darkMode } = controller;

  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState([]);
  
  // --- ESTADOS DE FILTRO ---
  const [systemFilter, setSystemFilter] = useState(null);
  const [searchText, setSearchText] = useState("");
  
  // Notificação
  const [notification, setNotification] = useState({ open: false, color: "info", message: "" });

  const API_URL = process.env.REACT_APP_API_URL;
  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
        const response = await api.get("/accounts");
        setAccounts(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
        console.error("Erro ao buscar contas:", error);
        setNotification({ open: true, color: "error", message: "Erro ao carregar contas." });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchAccounts();
  }, [token]);

  const closeNotification = () => setNotification({ ...notification, open: false });

  // --- LÓGICA DE DADOS ---
  
  const systemsList = useMemo(() => {
      const systems = accounts.map(acc => acc.system?.name_system).filter(Boolean);
      return [...new Set(systems)].sort();
  }, [accounts]);

  const rows = useMemo(() => {
      let data = accounts;

      if (systemFilter) {
          data = data.filter(acc => acc.system?.name_system === systemFilter);
      }

      if (searchText) {
          const lowerSearch = searchText.toLowerCase();
          data = data.filter(acc => 
              (acc.id_in_system_account && acc.id_in_system_account.toLowerCase().includes(lowerSearch)) ||
              (acc.name_account && acc.name_account.toLowerCase().includes(lowerSearch)) ||
              (acc.email_account && acc.email_account.toLowerCase().includes(lowerSearch)) ||
              (acc.cpf_account && acc.cpf_account.includes(lowerSearch))
          );
      }

      return data;
  }, [accounts, systemFilter, searchText]);


  const columns = useMemo(() => [
    {
      Header: "Login (ID)",
      accessor: "id_in_system_account",
      width: "20%",
      Cell: ({ value }) => <MDTypography variant="caption" fontWeight="bold">{value}</MDTypography>
    },
    {
        Header: "Nome da Conta",
        accessor: "name_account",
        width: "25%",
        Cell: ({ value, row }) => (
            <MDBox display="flex" flexDirection="column">
                <MDTypography variant="caption" fontWeight="medium">{value || "Sem Nome"}</MDTypography>
                {row.original.email_account && (
                    <MDTypography variant="caption" color="text" fontSize="0.65rem" sx={{opacity: 0.7}}>
                        {row.original.email_account}
                    </MDTypography>
                )}
            </MDBox>
        )
    },
    {
      Header: "Sistema",
      accessor: "system",
      align: "center",
      Cell: ({ row }) => <MDTypography variant="caption">{row.original.system?.name_system || "N/A"}</MDTypography>
    },
    {
        Header: "Dono (RH)",
        accessor: "identity",
        Cell: ({ row }) => {
            const identity = row.original.identity;
            return identity ? (
                <MDBox display="flex" flexDirection="column">
                    <MDTypography variant="caption" fontWeight="medium" color="info">
                        {identity.name_hr}
                    </MDTypography>
                    <MDTypography variant="caption" color="text" fontSize="0.65rem">
                        {identity.identity_id_hr}
                    </MDTypography>
                </MDBox>
            ) : (
                <MDTypography variant="caption" color="error" fontStyle="italic">
                    Não Vinculado (Órfã)
                </MDTypography>
            );
        }
    },
    {
        Header: "Status",
        accessor: "status_account",
        align: "center",
        Cell: ({ value }) => {
            let color = "secondary";
            const valLower = value ? value.toLowerCase() : "";
            if (valLower === 'ativo' || valLower === 'active') color = "success";
            if (valLower === 'inativo' || valLower === 'bloqueado' || valLower === 'inactive') color = "error";
            
            return (
                <MDBadge badgeContent={value || "N/A"} color={color} variant="gradient" size="sm" container />
            );
        }
    },
    // --- NOVA COLUNA ---
    {
        Header: "Criado em",
        accessor: "createdAt",
        align: "center",
        Cell: ({ value }) => (
             <MDTypography variant="caption" color="text">
                {value ? new Date(value).toLocaleDateString('pt-BR') : "-"}
             </MDTypography>
        )
    },
  ], []);

  return (
    <MDBox pt={2} pb={2} px={2}>
      
      {/* --- BARRA DE FERRAMENTAS (Alinhada à Direita) --- */}
      {/* Mudança aqui: justifyContent="flex-end" */}
      <MDBox display="flex" justifyContent="flex-end" alignItems="center" mb={3} flexWrap="wrap" gap={2}>
          
          <MDBox display="flex" alignItems="center" gap={2} sx={{ width: { xs: '100%', md: 'auto' }, flexWrap: 'wrap' }}>
              
              {/* 1. Dropdown de Sistema */}
              <MDBox sx={{ minWidth: "250px", flexGrow: 1 }}>
                  <Autocomplete
                      options={systemsList}
                      value={systemFilter}
                      onChange={(event, newValue) => setSystemFilter(newValue)}
                      renderInput={(params) => (
                          <MDInput 
                            {...params} 
                            label="Filtrar por Sistema" 
                            variant="outlined" 
                            // Altura forçada para alinhar com o search
                            sx={{ '& .MuiOutlinedInput-root': { padding: '4px !important', height: '44px' } }}
                          />
                      )}
                  />
              </MDBox>

              {/* 2. Campo de Pesquisa */}
              <MDBox sx={{ minWidth: "250px", flexGrow: 1 }}>
                  <MDInput 
                    label="Pesquisar..." 
                    variant="outlined" 
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    fullWidth
                    sx={{ '& .MuiOutlinedInput-root': { height: '44px' } }}
                    InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <Icon fontSize="small" sx={{ color: darkMode ? "#ffffff !important" : "inherit" }}>
                                search
                            </Icon>
                          </InputAdornment>
                        ),
                      }}
                  />
              </MDBox>
          </MDBox>

      </MDBox>

      <DataTable
        table={{ columns, rows }}
        isSorted={true}
        entriesPerPage={false}
        showTotalEntries
        noEndBorder
        isLoading={isLoading}
      />

      <MDSnackbar
        color={notification.color}
        icon="notifications"
        title="Gerenciamento de Contas"
        content={notification.message}
        open={notification.open}
        onClose={closeNotification}
        close={closeNotification}
      />
    </MDBox>
  );
}

export default ContasTab;