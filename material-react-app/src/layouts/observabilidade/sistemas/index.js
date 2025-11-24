// material-react-app/src/layouts/observabilidade/sistemas/index.js

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useMaterialUIController } from "context";
import { useNavigate } from "react-router-dom";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContentText from "@mui/material/DialogContentText";
import Tooltip from "@mui/material/Tooltip";
// Menu e MenuItem foram removidos pois agora usamos Dialog

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import MDBadge from "components/MDBadge";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";

// Importa os 3 modais separados (mantidos conforme solicitado)
import RHDataSourceModal from "./components/RHDataSourceModal";
import IDMDataSourceModal from "./components/IDMDataSourceModal";
import SistemaDataSourceModal from "./components/SistemaDataSourceModal";

// Modais de Visualização
import DataSourceViewModal from "./components/DataSourceViewModal";
import SystemProfilesModal from "./components/SystemProfilesModal";

function GerenciarDataSources() {
  const [controller] = useMaterialUIController();
  const { token, darkMode } = controller;
  const navigate = useNavigate();

  const [systems, setSystems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notification, setNotification] = useState({ open: false, color: "info", title: "", content: "" });
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [systemToDelete, setSystemToDelete] = useState(null);

  // Controle de Modais de Edição/Criação
  const [activeModal, setActiveModal] = useState(null);
  const [editingDataSource, setEditingDataSource] = useState(null);
  
  // Estado para o Modal de Seleção de Tipo (substitui o Menu)
  const [isSelectionDialogOpen, setIsSelectionDialogOpen] = useState(false);

  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [dataSourceToView, setDataSourceToView] = useState(null);

  const [isProfilesModalOpen, setIsProfilesModalOpen] = useState(false);
  const [systemForProfiles, setSystemForProfiles] = useState(null);

  const fetchSystems = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const response = await axios.get('/systems', {
        headers: { "Authorization": `Bearer ${token}` },
      });
      setSystems(response.data);
    } catch (error) {
      console.error("Erro ao buscar fontes de dados:", error);
      setSystems([]);
      setNotification({ open: true, color: "error", title: "Erro de Rede", content: "Não foi possível carregar as fontes de dados da API." });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchSystems();
    } else {
      setSystems([]);
      setIsLoading(false);
    }
  }, [token]);

  // Handlers
  
  // Abre o modal de seleção (Dialog)
  const handleOpenSelectionDialog = () => {
    setIsSelectionDialogOpen(true);
  };

  // Escolhe o tipo e abre o formulário correspondente
  const handleSelectAddType = (type) => {
    setEditingDataSource(null); // Garante que é criação
    setActiveModal(type); // "RH", "IDM" ou "SISTEMA"
    setIsSelectionDialogOpen(false); // Fecha o modal de seleção
  };
  
  const handleEditClick = (dataSource) => {
    setEditingDataSource(dataSource);
    setActiveModal(dataSource.origem_datasource); 
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setEditingDataSource(null);
  };

  const handleViewClick = (dataSource) => {
    setDataSourceToView(dataSource);
    setIsViewModalOpen(true);
  };
  const handleCloseViewModal = () => {
    setIsViewModalOpen(false);
    setDataSourceToView(null);
  };

  const handleSaveDataSource = async (formData) => {
    try {
      const headers = { "Authorization": `Bearer ${token}` };
      let action = "criada";
      let response;

      const isEditing = !!editingDataSource?.id;

      if (isEditing) {
        action = "atualizada";
        response = await axios.patch(`/systems/${editingDataSource.id}`, formData, { headers });
        
        setNotification({
          open: true,
          color: "success",
          title: "Sucesso",
          content: `Fonte de dados "${response.data.name_datasource}" ${action} com sucesso!`
        });
        handleCloseModal();
        fetchSystems();

      } else {
        response = await axios.post('/systems', formData, { headers });
        const newDataSource = response.data;
        
        handleCloseModal();
        
        // Redirecionamento com Delay
        if (newDataSource && newDataSource.id) {
          setTimeout(() => {
              navigate(`/observabilidade/mapeamento-dados/${newDataSource.id}`);
          }, 100);
        } else {
          setNotification({ open: true, color: "error", title: "Erro", content: "Não foi possível obter o ID da nova fonte para redirecionamento." });
          fetchSystems();
        }
      }

    } catch (error) {
      console.error("Erro ao salvar fonte de dados:", error);
      const errorMessage = error.response?.data?.message || "Ocorreu um erro inesperado.";
      
      if (!activeModal) {
         setNotification({
          open: true,
          color: "error",
          title: "Erro ao Salvar",
          content: errorMessage
        });
      }
      throw new Error(errorMessage);
    }
  };

  const handleOpenDeleteDialog = (system) => {
    setSystemToDelete(system);
    setIsDeleteDialogOpen(true);
  };
  
  const handleCloseDeleteDialog = () => {
    setSystemToDelete(null);
    setIsDeleteDialogOpen(false);
  };
  
  const handleConfirmDelete = async () => {
    if (!systemToDelete) return;
    try {
      await axios.delete(`/systems/${systemToDelete.id}`, {
        headers: { "Authorization": `Bearer ${token}` },
      });
      setNotification({ open: true, color: "success", title: "Sucesso", content: `Fonte de dados "${systemToDelete.name_datasource}" excluída.` });
      handleCloseDeleteDialog();
      fetchSystems();
    } catch (error) {
      console.error("Erro ao excluir fonte de dados:", error);
      const errorMessage = error.response?.data?.message || "Não foi possível excluir a fonte de dados.";
      setNotification({ open: true, color: "error", title: "Erro", content: errorMessage });
      handleCloseDeleteDialog();
    }
  };

  const closeNotification = () => setNotification({ ...notification, open: false });

  const handleOpenProfilesModal = (system) => {
    setSystemForProfiles(system);
    setIsProfilesModalOpen(true);
  };

  const handleCloseProfilesModal = () => {
    setSystemForProfiles(null);
    setIsProfilesModalOpen(false);
  };

  const columns = useMemo(() => [
    {
      Header: "Nome da Fonte",
      accessor: "name_datasource",
      Cell: ({ value }) => <MDTypography variant="caption" fontWeight="medium">{value}</MDTypography>
    },
    {
      Header: "Origem",
      accessor: "origem_datasource",
      align: "center",
      Cell: ({ value }) => <MDTypography variant="caption">{value || "N/A"}</MDTypography>
    },
    {
      Header: "Tipo",
      accessor: "type_datasource",
      align: "center",
      // --- Lógica para exibir o Tipo correto com Nome do Banco ---
      Cell: ({ row: { original: dataSource } }) => {
        let displayType = dataSource.type_datasource || "N/A";

        // Helper para formatar o nome do banco (ex: postgres -> Postgres)
        const formatDbName = (type) => type ? ` - ${type.charAt(0).toUpperCase() + type.slice(1)}` : '';

        // 1. SISTEMA
        if (dataSource.origem_datasource === "SISTEMA" && dataSource.systemConfig) {
            const { tipo_fonte_contas, tipo_fonte_recursos, db_type } = dataSource.systemConfig;
            
            if (tipo_fonte_contas === 'DATABASE' || tipo_fonte_recursos === 'DATABASE') {
                displayType = `DATABASE${formatDbName(db_type || 'postgres')}`;
            } 
            else if (tipo_fonte_contas === 'API' || tipo_fonte_recursos === 'API') {
                displayType = "API";
            } 
            else {
                displayType = "CSV";
            }
        } 
        // 2. RH (CORREÇÃO APLICADA: Checa host ou url, e formata nome)
        else if (dataSource.origem_datasource === "RH" && dataSource.hrConfig) {
            const { db_host, db_url, db_type } = dataSource.hrConfig;
            
            if (db_host || db_url) {
                displayType = `DATABASE${formatDbName(db_type || 'postgres')}`;
            } else {
                displayType = "CSV";
            }
        }
        // 3. IDM
        else if (dataSource.origem_datasource === "IDM") {
             displayType = "API";
        }

        return <MDTypography variant="caption">{displayType}</MDTypography>;
      }
    },
    {
      Header: "Mapeamento",
      accessor: "mapping", 
      align: "center",
      disableSortBy: true,
      Cell: ({ row: { original: dataSource } }) => {
        const { origem_datasource, mappingRH, mappingIDM, mappingSystem } = dataSource;
        let isMapped = false;

        if (origem_datasource === "RH") {
          isMapped = mappingRH && 
                     mappingRH.identity_id_hr && 
                     mappingRH.email_hr && 
                     mappingRH.status_hr;
                     
        } else if (origem_datasource === "IDM") {
          isMapped = mappingIDM && 
                     mappingIDM.identity_id_idm && 
                     mappingIDM.email_idm && 
                     mappingIDM.status_idm;
                     
        } else if (origem_datasource === "SISTEMA") {
          const map = mappingSystem;
          const contasMapeadas = map && map.accounts_id_in_system && map.accounts_email && map.accounts_identity_id;
          const recursosMapeados = map && map.resources_name && map.resources_permissions;
          isMapped = contasMapeadas && recursosMapeados;
        }

        return (
          <MDBadge
            color={isMapped ? "success" : "warning"}
            badgeContent={isMapped ? "Mapeado" : "Pendente"}
            variant="gradient"
            size="sm"
            container
          />
        );
      }
    },
    {
      Header: "Criado em",
      accessor: "createdAt",
      align: "center",
      Cell: ({ value }) => <MDTypography variant="caption">{value ? new Date(value).toLocaleDateString('pt-BR') : "N/A"}</MDTypography>
    },
    {
      Header: "Ações",
      accessor: "actions",
      align: "center",
      disableSortBy: true,
      Cell: ({ row: { original: dataSource } }) => {
        
        return (
          <MDBox display="flex" justifyContent="center" alignItems="center" sx={{ gap: 1 }}>
            <Tooltip title="Visualizar Detalhes">
              <MDTypography component="a" color="text" sx={{ cursor: "pointer" }} onClick={() => handleViewClick(dataSource)}>
                <Icon fontSize="small">visibility</Icon>
              </MDTypography>
            </Tooltip>

            <Tooltip title="Listar Dados Processados">
              <MDTypography component="a" color="dark" sx={{ cursor: 'pointer' }} onClick={() => handleOpenProfilesModal(dataSource)}>
                <Icon fontSize="small">people</Icon>
              </MDTypography>
            </Tooltip>
            
            <Tooltip title="Editar">
              <MDTypography component="a" color="info" sx={{ cursor: 'pointer' }} onClick={() => handleEditClick(dataSource)}>
                <Icon fontSize="small">edit</Icon>
              </MDTypography>
            </Tooltip>

             <Tooltip title="Excluir">
               <MDTypography component="a" color="error" sx={{ cursor: 'pointer' }} onClick={() => handleOpenDeleteDialog(dataSource)}>
                 <Icon fontSize="small">delete</Icon>
               </MDTypography>
             </Tooltip>
          </MDBox>
        );
      }
    },
  ], [systems]);

  const rows = useMemo(() => systems.map(system => ({
    ...system,
  })), [systems]);


  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
            <Card>
              <MDBox
                mx={2} mt={-3} py={3} px={2}
                variant="gradient" bgColor="info" borderRadius="lg" coloredShadow="info"
                display="flex" justifyContent="space-between" alignItems="center"
              >
                <MDTypography variant="h6" color="white">
                  Gerenciamento de Fontes de Dados
                </MDTypography>
                
                {/* Botão que abre o Modal de Seleção */}
                <MDButton variant="gradient" color="dark" onClick={handleOpenSelectionDialog}>
                  <Icon sx={{ fontWeight: "bold" }}>add</Icon>
                  &nbsp;Adicionar Fonte de Dados
                </MDButton>
                
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={{ columns, rows }}
                  isSorted={true}
                  entriesPerPage={{ defaultValue: 10, entries: [5, 10, 15, 20, 25] }}
                  showTotalEntries
                  noEndBorder
                  canSearch
                  isLoading={isLoading}
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      {/* Modal de Seleção */}
      <Dialog open={isSelectionDialogOpen} onClose={() => setIsSelectionDialogOpen(false)}>
          <DialogTitle>Selecione o Tipo de Fonte</DialogTitle>
          <DialogContent sx={{ p: 2, minWidth: '300px' }}>
              <DialogContentText sx={{ mb: 2 }}>
                  Qual a origem dos dados que você deseja cadastrar?
              </DialogContentText>
              <MDBox display="flex" flexDirection="column" gap={2}>
                  <MDButton variant="gradient" color="info" onClick={() => handleSelectAddType("RH")}>
                      RH (Recursos Humanos)
                  </MDButton>
                  <MDButton variant="gradient" color="secondary" onClick={() => handleSelectAddType("IDM")}>
                      IDM (Identity Management)
                  </MDButton>
                  <MDButton variant="gradient" color="success" onClick={() => handleSelectAddType("SISTEMA")}>
                      SISTEMA (Catálogo de Aplicações)
                  </MDButton>
              </MDBox>
          </DialogContent>
          <DialogActions>
             <MDButton onClick={() => setIsSelectionDialogOpen(false)} color="text">
                Cancelar
             </MDButton>
          </DialogActions>
      </Dialog>


      {/* Modal de RH */}
      {activeModal === "RH" && (
        <RHDataSourceModal
          open={true}
          onClose={handleCloseModal}
          onSave={async (formData) => {
            try {
              await handleSaveDataSource(formData);
            } catch (error) {
              console.error("Erro no modal RH", error);
            }
          }}
          initialData={editingDataSource}
        />
      )}

      {/* Modal de Sistema */}
      {activeModal === "SISTEMA" && (
        <SistemaDataSourceModal
          open={true}
          onClose={handleCloseModal}
          onSave={async (formData) => {
            try {
              await handleSaveDataSource(formData);
            } catch (error) {
              console.error("Erro no modal Sistema", error);
            }
          }}
          initialData={editingDataSource}
        />
      )}

      {/* Modal de IDM */}
      {activeModal === "IDM" && (
        <IDMDataSourceModal
          open={true}
          onClose={handleCloseModal}
          onSave={async (formData) => {
            try {
              await handleSaveDataSource(formData);
            } catch (error) {
              console.error("Erro no modal IDM", error);
            }
          }}
          initialData={editingDataSource}
        />
      )}

      {isViewModalOpen && (
        <DataSourceViewModal
          open={isViewModalOpen}
          onClose={handleCloseViewModal}
          dataSource={dataSourceToView}
          darkMode={darkMode}
        />
      )}

      {isProfilesModalOpen && (
        <SystemProfilesModal
          open={isProfilesModalOpen}
          onClose={handleCloseProfilesModal}
          dataSource={systemForProfiles} 
          onDataClear={fetchSystems} 
        />
      )}

      <Dialog open={isDeleteDialogOpen} onClose={handleCloseDeleteDialog}>
          <DialogTitle>Confirmar Exclusão</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Você tem certeza que deseja excluir a fonte de dados "<strong>{systemToDelete?.name_datasource}</strong>"? Esta ação não pode ser desfeita.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseDeleteDialog} color="secondary">
            Cancelar
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" variant="gradient">
            Excluir
          </MDButton>
        </DialogActions>
      </Dialog>

      <MDSnackbar
        color={notification.color}
        icon="notifications"
        title={notification.title}
        content={notification.content}
        dateTime="agora"
        open={notification.open}
        onClose={closeNotification}
        close={closeNotification}
      />

    </DashboardLayout>
  );
}

export default GerenciarDataSources;