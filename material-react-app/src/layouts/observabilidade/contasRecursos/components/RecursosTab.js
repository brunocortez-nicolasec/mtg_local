// material-react-app/src/layouts/observabilidade/contasRecursos/components/RecursosTab.js

import { useState, useEffect, useMemo } from "react";
import { useMaterialUIController } from "context";
import axios from "axios";

// @mui material components
import Icon from "@mui/material/Icon";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment"; // Para o ícone de lupa

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DataTable from "examples/Tables/DataTable";
import MDSnackbar from "components/MDSnackbar";

// Modal
import EditResourceAliasModal from "./EditResourceAliasModal";

function RecursosTab() {
  const [controller] = useMaterialUIController();
  const { token, darkMode } = controller;

  const [isLoading, setIsLoading] = useState(true);
  const [resources, setResources] = useState([]);
  
  // --- ESTADOS DE FILTRO ---
  const [systemFilter, setSystemFilter] = useState(null);
  const [searchText, setSearchText] = useState(""); // Novo estado para a busca
  
  // Estados do Modal e Notificação
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [notification, setNotification] = useState({ open: false, color: "info", message: "" });

  const API_URL = process.env.REACT_APP_API_URL;
  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  const fetchResources = async () => {
    setIsLoading(true);
    try {
        const response = await api.get("/resources");
        setResources(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
        console.error("Erro ao buscar recursos:", error);
        setNotification({ open: true, color: "error", message: "Erro ao carregar recursos." });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) fetchResources();
  }, [token]);

  const handleEditClick = (resource) => {
    setSelectedResource(resource);
    setEditModalOpen(true);
  };

  const handleSaveAliases = async (id, newAliases) => {
      try {
          await api.patch(`/resources/${id}`, { aliases: newAliases });
          setNotification({ open: true, color: "success", message: "Apelidos atualizados com sucesso!" });
          fetchResources(); 
      } catch (error) {
          console.error("Erro ao salvar alias:", error);
          setNotification({ open: true, color: "error", message: "Erro ao salvar alterações." });
      }
  };

  const closeNotification = () => setNotification({ ...notification, open: false });

  // --- LÓGICA DE DADOS ---
  
  // 1. Lista de Sistemas Únicos para o Dropdown
  const systemsList = useMemo(() => {
      const systems = resources.map(r => r.system?.name_system).filter(Boolean);
      return [...new Set(systems)].sort();
  }, [resources]);

  // 2. Filtragem Combinada (Sistema + Busca de Texto)
  const rows = useMemo(() => {
      let data = resources;

      // Filtro 1: Sistema
      if (systemFilter) {
          data = data.filter(r => r.system?.name_system === systemFilter);
      }

      // Filtro 2: Busca por Texto (Nome, Descrição ou Alias)
      if (searchText) {
          const lowerSearch = searchText.toLowerCase();
          data = data.filter(r => 
              (r.name_resource && r.name_resource.toLowerCase().includes(lowerSearch)) ||
              (r.description_resource && r.description_resource.toLowerCase().includes(lowerSearch)) ||
              (r.aliases && Array.isArray(r.aliases) && r.aliases.some(a => a.toLowerCase().includes(lowerSearch)))
          );
      }

      return data;
  }, [resources, systemFilter, searchText]);


  // Definição das colunas
  const columns = useMemo(() => [
    {
      Header: "Nome Técnico (ID)",
      accessor: "name_resource",
      width: "25%",
      Cell: ({ value }) => <MDTypography variant="caption" fontWeight="bold">{value}</MDTypography>
    },
    {
        Header: "Alias (Nome Amigável)",
        accessor: "aliases",
        width: "30%",
        Cell: ({ value }) => (
          <MDBox display="flex" flexWrap="wrap" gap={0.5}>
            {Array.isArray(value) && value.length > 0 ? (
                value.map((alias, idx) => (
                    <Chip 
                        key={idx} 
                        label={alias} 
                        size="small" 
                        variant="outlined" 
                        color="info" 
                        sx={{ height: '20px', fontSize: '0.65rem' }}
                    />
                ))
            ) : (
                <MDTypography variant="caption" color="text" fontStyle="italic">Sem alias</MDTypography>
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
      Header: "Descrição",
      accessor: "description_resource",
      Cell: ({ value }) => (
        <Tooltip title={value || ""}>
             <MDTypography variant="caption" sx={{maxWidth: '200px', display:'block', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                {value || "-"}
             </MDTypography>
        </Tooltip>
      )
    },
    {
      Header: "Ações",
      accessor: "actions",
      align: "center",
      Cell: ({ row }) => (
        <MDBox display="flex" justifyContent="center" alignItems="center">
          <Tooltip title="Editar Aliases">
            <MDTypography 
                component="a" 
                color="info" 
                onClick={() => handleEditClick(row.original)}
                sx={{ cursor: 'pointer' }}
            >
              <Icon fontSize="small">edit</Icon>
            </MDTypography>
          </Tooltip>
        </MDBox>
      )
    },
  ], []);

  return (
    <MDBox pt={2} pb={2} px={2}>
      
      {/* --- BARRA DE FERRAMENTAS (BOTÃO + FILTROS) --- */}
      <MDBox display="flex" justifyContent="flex-end" alignItems="center" mb={3} flexWrap="wrap" gap={2}>

          {/* Área de Filtros (Lado Direito) */}
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
        table={{ columns, rows }} // Passamos as rows já filtradas manualmente
        isSorted={true}
        entriesPerPage={false}
        showTotalEntries
        noEndBorder
        // canSearch={true} // REMOVIDO: Removemos a busca interna para usar a nossa personalizada
        isLoading={isLoading}
      />

      {/* Modal de Edição */}
      <EditResourceAliasModal 
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        resource={selectedResource}
        onSave={handleSaveAliases}
      />

      <MDSnackbar
        color={notification.color}
        icon="notifications"
        title="Gerenciamento de Recursos"
        content={notification.message}
        open={notification.open}
        onClose={closeNotification}
        close={closeNotification}
      />
    </MDBox>
  );
}

export default RecursosTab;