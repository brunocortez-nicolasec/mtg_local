// material-react-app/src/layouts/observabilidade/excecoes/index.js

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useMaterialUIController } from "context";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Modal from "@mui/material/Modal";
import Divider from "@mui/material/Divider";

// Libs para Relatórios
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDSnackbar from "components/MDSnackbar";
import PropTypes from 'prop-types';

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";


// --- COMPONENTE HELPER PADRONIZADO (CORRIGIDO) ---
function DetailItem({ icon, label, value, children, darkMode }) {
  // CORREÇÃO: Usamos "text" (que se adapta) ou forçamos "white" no dark mode explicitamente
  // Mas para garantir igual ao lado direito, vamos usar a cor do texto padrão do tema dark
  const textColor = darkMode ? "white" : "text";

  return (
    <MDBox display="flex" alignItems="center" mb={1.5} lineHeight={1}>
      <Icon color="secondary" fontSize="small" sx={{ mr: 1.5 }}>
        {icon}
      </Icon>
      
      {/* Rótulo (ex: "Justificativa:") */}
      <MDTypography variant="button" fontWeight="bold" color={textColor} sx={{ opacity: 0.9 }}>
        {label}:&nbsp;
      </MDTypography>

      {/* Valor (ex: "d") */}
      {value != null && value !== '' && (
        <MDTypography variant="button" fontWeight="regular" color={textColor}>
          {value}
        </MDTypography>
      )}
        {!value && value !== 0 && value !== false && !children && ( 
          <MDTypography variant="button" fontWeight="regular" color={textColor} sx={{ opacity: 0.6 }}>
            N/A
          </MDTypography>
        )}
      {children}
    </MDBox>
  );
}

DetailItem.propTypes = {
  icon: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  children: PropTypes.node,
  darkMode: PropTypes.bool,
};
DetailItem.defaultProps = {
    value: null,
    children: null,
    darkMode: false,
};
// --- FIM DO HELPER ---


const ExceptionDetailsModal = ({ open, onClose, isLoading, details, getDivergenceLabel, darkMode }) => {
  if (!open) return null; 

  const renderDetailsContent = () => {
    if (!details) {
        return <MDTypography color={darkMode ? "white" : "text"}>Não foi possível carregar os detalhes.</MDTypography>;
    }

    const isAccountException = details.type === 'Account';
    const isIdentityException = details.type === 'Identity';

    const identityData = isIdentityException ? details.identity : details.account?.identity;
    const accountData = isAccountException ? details.account : null;
    
    // Título das seções agora respeita darkMode
    const SectionTitle = ({ children }) => (
        <MDTypography variant="h6" fontWeight="medium" color={darkMode ? "white" : "dark"} sx={{ mb: 2 }}>
            {children}
        </MDTypography>
    );

    const renderDivergenceSpecifics = () => {
        if (!details.divergenceDetails) return <DetailItem icon="help_outline" label="Detalhes" value="Nenhuma informação adicional." darkMode={darkMode} />;

        const { divergenceCode, divergenceDetails } = details;
        const { rhData, appData, targetSystem } = divergenceDetails; 

        const getSystemName = (data) => data?.system?.name_system ?? 'Sistema'; 

        switch (divergenceCode) {
            case "CPF_MISMATCH":
              return (
                <>
                  <DetailItem icon="badge" label={`CPF no RH`} value={rhData?.cpf_hr} darkMode={darkMode} />
                  <DetailItem icon="badge" label={`CPF em ${getSystemName(appData)}`} value={appData?.cpf_account} darkMode={darkMode} />
                </>
              );
            case "NAME_MISMATCH":
              return (
                <>
                  <DetailItem icon="person" label={`Nome no RH`} value={rhData?.name_hr} darkMode={darkMode} />
                  <DetailItem icon="person" label={`Nome em ${getSystemName(appData)}`} value={appData?.name_account} darkMode={darkMode} />
                </>
              );
            case "EMAIL_MISMATCH":
              return (
                <>
                  <DetailItem icon="email" label={`Email no RH`} value={rhData?.email_hr} darkMode={darkMode} />
                  <DetailItem icon="email" label={`Email em ${getSystemName(appData)}`} value={appData?.email_account} darkMode={darkMode} />
                </>
              );
            case "ZOMBIE_ACCOUNT":
              return (
                <>
                  <DetailItem icon="toggle_off" label={`Status no RH`} value={rhData?.status_hr} darkMode={darkMode} />
                  <DetailItem icon="toggle_on" label={`Status em ${getSystemName(appData)}`} value={appData?.status_account} darkMode={darkMode} />
                </>
              );
            case "ACCESS_NOT_GRANTED":
              return <DetailItem icon="link_off" label={`Acesso esperado em`} value={targetSystem} darkMode={darkMode} />;
            case "ORPHAN_ACCOUNT":
                return <DetailItem icon="no_accounts" label={`Conta Órfã em`} value={appData?.system?.name_system || 'Sistema desconhecido'} darkMode={darkMode} />; 
            case "DORMANT_ADMIN":
                return <DetailItem icon="timer_off" label={`Admin dormente em`} value={appData?.system?.name_system || 'Sistema desconhecido'} darkMode={darkMode} />; 
            default:
              return <DetailItem icon="help_outline" label="Detalhes" value="Nenhuma informação adicional." darkMode={darkMode} />;
        }
    };

    const renderIdentityDetails = () => (
        <MDBox>
            <SectionTitle>{isIdentityException ? "Identidade (RH)" : "Identidade Vinculada (RH)"}</SectionTitle>
            {!identityData ? (
                <MDTypography variant="caption" color="textSecondary" sx={{ color: darkMode ? "rgba(255,255,255,0.7)" : "inherit" }}>Esta conta (Órfã) não está vinculada a nenhuma identidade do RH.</MDTypography>
            ) : (
                 <>
                   <DetailItem icon="person_outline" label="Nome" value={identityData?.name_hr} darkMode={darkMode} />
                   <DetailItem icon="email" label="Email" value={identityData?.email_hr} darkMode={darkMode} />
                   <DetailItem icon="badge" label="CPF" value={identityData?.cpf_hr} darkMode={darkMode} />
                   <DetailItem icon="vpn_key" label="ID RH" value={identityData?.identity_id_hr} darkMode={darkMode} />
                   <DetailItem icon="engineering" label="Tipo" value={identityData?.user_type_hr} darkMode={darkMode} />
                   <DetailItem icon={identityData?.status_hr === 'Ativo' ? "check_circle" : "cancel"} label="Status RH" value={identityData?.status_hr} darkMode={darkMode} />
                 </>
            )}
        </MDBox>
    );

    const renderAccountDetails = () => {
        if (!accountData) return <MDTypography variant="caption" color={darkMode ? "white" : "text"}>Dados da conta indisponíveis.</MDTypography>;
         return (
            <MDBox>
              <SectionTitle>Conta (Sistema)</SectionTitle>
              <DetailItem icon="computer" label="Sistema" value={accountData?.system?.name_system} darkMode={darkMode} />
              <DetailItem icon="vpn_key" label="ID no Sistema" value={accountData?.id_in_system_account} darkMode={darkMode} />
              <DetailItem icon="person_outline" label="Nome na Conta" value={accountData?.name_account} darkMode={darkMode} />
              <DetailItem icon="email" label="Email na Conta" value={accountData?.email_account} darkMode={darkMode} />
              <DetailItem icon="badge" label="CPF na Conta" value={accountData?.cpf_account} darkMode={darkMode} /> 
              <DetailItem icon="admin_panel_settings" label="Perfis na Conta" value={accountData?.profileNames || 'Nenhum'} darkMode={darkMode} />
              <DetailItem icon={accountData?.status_account === 'Ativo' ? "toggle_on" : "toggle_off"} label="Status Conta" value={accountData?.status_account} darkMode={darkMode} />
           </MDBox>
         );
    };

    return (
        <>
            <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                    {renderIdentityDetails()}
                </Grid>
                <Grid item xs={12} md={6}>
                    {isAccountException ? renderAccountDetails() : (
                        <MDBox>
                            <SectionTitle>Divergência Ignorada</SectionTitle>
                            <DetailItem icon="warning" label="Tipo" value={getDivergenceLabel(details.divergenceCode)} darkMode={darkMode} />
                            {renderDivergenceSpecifics()}
                        </MDBox>
                    )}
                </Grid>
            </Grid>

            {isAccountException && (
                <>
                    <Divider sx={{ my: 2, backgroundColor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }} />
                    <MDBox>
                        <SectionTitle>Divergência Ignorada (Detalhes)</SectionTitle>
                        <DetailItem icon="warning" label="Tipo" value={getDivergenceLabel(details.divergenceCode)} darkMode={darkMode} />
                        {renderDivergenceSpecifics()}
                    </MDBox>
                </>
            )}

            <Divider sx={{ my: 2, backgroundColor: darkMode ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.1)" }} />

            <MDBox>
                <SectionTitle>Detalhes da Aprovação</SectionTitle>
                <Grid container spacing={3}>
                    <Grid item xs={12} md={6}>
                        <DetailItem icon="how_to_reg" label="Aprovado por" value={details.user?.name} darkMode={darkMode} />
                        <DetailItem icon="event" label="Data" value={details.createdAt ? new Date(details.createdAt).toLocaleString('pt-BR') : ""} darkMode={darkMode} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                        <DetailItem icon="comment" label="Justificativa" value={details.justification} darkMode={darkMode} />
                    </Grid>
                </Grid>
            </MDBox>
        </>
    );
  };

  return (
    <Modal open={open} onClose={onClose} sx={{ display: "grid", placeItems: "center" }}>
      <Card sx={{ width: "90%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}>
        <MDBox p={2} display="flex" justifyContent="space-between" alignItems="center">
          <MDTypography variant="h5" color={darkMode ? "white" : "dark"}>Detalhes da Exceção</MDTypography>
          <Icon
            sx={({ typography: { size }, palette: { dark, white } }) => ({
                fontSize: `${size.lg} !important`,
                color: darkMode ? white.main : dark.main,
                stroke: "currentColor",
                strokeWidth: "2px",
                cursor: "pointer",
             })}
            onClick={onClose}
          >
            close
          </Icon>
        </MDBox>

        <MDBox p={3} pt={1}>
          {isLoading
             ? <MDBox display="flex" justifyContent="center" py={5}><CircularProgress color="info" /></MDBox>
             : renderDetailsContent() 
          }
        </MDBox>
      </Card>
    </Modal>
  );
};

ExceptionDetailsModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  isLoading: PropTypes.bool.isRequired,
  details: PropTypes.object, 
  getDivergenceLabel: PropTypes.func.isRequired,
  darkMode: PropTypes.bool,
};

ExceptionDetailsModal.defaultProps = {
  details: null,
  darkMode: false,
};


function GerenciarExcecoes() {
    const [controller] = useMaterialUIController();
    const { token, darkMode } = controller;
    const [exceptions, setExceptions] = useState([]); 
    const [isLoading, setIsLoading] = useState(true);
    const [notification, setNotification] = useState({ open: false, color: "info", title: "", content: "" });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [exceptionToDelete, setExceptionToDelete] = useState(null); 
    const [exportMenu, setExportMenu] = useState(null);
    const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
    const [detailsModalState, setDetailsModalState] = useState({ isOpen: false, isLoading: false, data: null });

    const API_URL = process.env.REACT_APP_API_URL;

    const api = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    const divergenceLabels = {
        ACCESS_NOT_GRANTED: "Acesso Previsto Não Concedido",
        ZOMBIE_ACCOUNT: "Acesso Ativo Indevido",
        CPF_MISMATCH: "Divergência de CPF",
        NAME_MISMATCH: "Divergência de Nome",
        EMAIL_MISMATCH: "Divergência de E-mail",
        DORMANT_ADMIN: "Admin Dormente",
        ORPHAN_ACCOUNT: "Conta Órfã",
        USERTYPE_MISMATCH: "Divergência de Tipo de Usuário", 
    };

    const getDivergenceLabel = (code) => divergenceLabels[code] || code;

    const fetchExceptions = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await api.get('/divergences/exceptions');
            const data = response.data;
            setExceptions(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar exceções:", error);
            setExceptions([]); 
            setNotification({ open: true, color: "error", title: "Erro de Rede", content: "Não foi possível carregar as exceções." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchExceptions();
        }
    }, [token]);

    const handleOpenDetailsModal = async (exception) => { 
        setDetailsModalState({ isOpen: true, isLoading: true, data: null }); 
        try {
            const response = await api.get(`/divergences/exceptions/${exception.id}`, {
                params: { type: exception.type } 
            });
            setDetailsModalState({ isOpen: true, isLoading: false, data: response.data }); 
        } catch (error) {
            console.error("Erro ao buscar detalhes da exceção:", error);
            setNotification({ open: true, color: "error", title: "Erro", content: "Não foi possível carregar os detalhes da exceção." });
            setDetailsModalState({ isOpen: false, isLoading: false, data: null }); 
        }
    };

    const handleCloseDetailsModal = () => setDetailsModalState({ isOpen: false, isLoading: false, data: null });

    const handleOpenDeleteDialog = (exception) => { 
        setExceptionToDelete(exception); 
        setDeleteDialogOpen(true);
    };

    const handleCloseDeleteDialog = () => {
        setExceptionToDelete(null);
        setDeleteDialogOpen(false);
    };

    const handleConfirmDelete = async () => {
        if (!exceptionToDelete) return;
        try {
            await api.delete(`/divergences/exceptions/${exceptionToDelete.id}`, {
                params: { type: exceptionToDelete.type } 
            });
            setNotification({ open: true, color: "success", title: "Sucesso", content: "Exceção removida. O risco voltará a ser monitorado." });
            fetchExceptions(); 
        } catch (error) {
            console.error("Erro ao remover exceção:", error);
            setNotification({ open: true, color: "error", title: "Erro", content: "Não foi possível remover a exceção." });
        } finally {
            handleCloseDeleteDialog();
        }
    };

    const handleOpenBulkDeleteDialog = () => {
        if (exceptions.length > 0) {
            setBulkDeleteDialogOpen(true);
        } else {
             setNotification({ open: true, color: "warning", title: "Aviso", content: "Não há exceções para remover." });
        }
    };

    const handleCloseBulkDeleteDialog = () => {
        setBulkDeleteDialogOpen(false);
    };

    const handleConfirmBulkDelete = async () => {
        if (exceptions.length === 0) return;

        const identityExceptionIds = exceptions
            .filter(ex => ex.type === 'Identity')
            .map(ex => ex.id);
        const accountExceptionIds = exceptions
            .filter(ex => ex.type === 'Account')
            .map(ex => ex.id);
            
        setIsLoading(true); 
        handleCloseBulkDeleteDialog();

        try {
            const promises = [];
            if (identityExceptionIds.length > 0) {
                promises.push(api.post('/divergences/exceptions/bulk-delete', 
                    { exceptionIds: identityExceptionIds, type: 'Identity' }
                ));
            }
            if (accountExceptionIds.length > 0) {
                promises.push(api.post('/divergences/exceptions/bulk-delete', 
                    { exceptionIds: accountExceptionIds, type: 'Account' }
                ));
            }
            
            if (promises.length > 0) {
                 await Promise.all(promises);
                 setNotification({ open: true, color: "success", title: "Sucesso", content: "Todas as exceções foram removidas com sucesso." });
                 fetchExceptions(); 
            } else {
                 setNotification({ open: true, color: "info", title: "Informação", content: "Nenhuma exceção encontrada para remover." });
            }

        } catch (error) {
            console.error("Erro ao remover todas as exceções:", error);
            setNotification({ open: true, color: "error", title: "Erro", content: "Não foi possível remover todas as exceções." });
        } finally {
             setIsLoading(false);
        }
    };

    const closeNotification = () => setNotification({ ...notification, open: false });
    const openExportMenu = (event) => setExportMenu(event.currentTarget);
    const closeExportMenu = () => setExportMenu(null);

    const escapeCsv = (str) => `"${String(str ?? '').replace(/"/g, '""')}"`;

    const handleExportCsv = () => {
        closeExportMenu();
        if (exceptions.length === 0) {
             setNotification({ open: true, color: "warning", title: "Exportação", content: "Não há dados para exportar." });
             return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent = "data:text/csv;charset=utf-8,\uFEFF";

        const headers = ["Tipo_Excecao", "Nome_Item", "Email_Item", "Sistema_Alvo", "Tipo_Divergencia", "Justificativa", "Aprovado_Por", "Data"];
        csvContent += headers.map(escapeCsv).join(",") + "\r\n";

        exceptions.forEach(ex => {
            const isIdentityEx = ex.type === 'Identity';
            const item = isIdentityEx ? ex.identity : ex.account;
            
            const itemName = item?.name_hr || item?.name_account || (isIdentityEx ? `ID_RH:${ex.identity?.identity_id_hr}` : `ID_Sistema:${ex.account?.id_in_system_account}`) || "Item Desconhecido";
            const itemEmail = item?.email_hr || item?.email_account || "N/A";
            const systemName = ex.targetSystem || item?.system?.name_system || "N/A"; 

            const row = [
                ex.type,
                itemName,
                itemEmail,
                systemName,
                getDivergenceLabel(ex.divergenceCode),
                ex.justification,
                ex.user?.name || "N/A",
                ex.createdAt ? new Date(ex.createdAt).toLocaleDateString('pt-BR') : "N/A",
            ];
            csvContent += row.map(escapeCsv).join(",") + "\r\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "relatorio_excecoes.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };
    
    const handleExportPdf = () => {
        closeExportMenu();
         if (exceptions.length === 0) {
             setNotification({ open: true, color: "warning", title: "Exportação", content: "Não há dados para exportar." });
             return;
        }

        const doc = new jsPDF();
        const tableColumns = ["Item", "Sistema", "Tipo Divergência", "Aprovado Por", "Data"];
        const tableRows = [];

        exceptions.forEach(ex => {
            const isIdentityEx = ex.type === 'Identity';
            const item = isIdentityEx ? ex.identity : ex.account;
            
            const itemName = item?.name_hr || item?.name_account || (isIdentityEx ? `ID_RH:${ex.identity?.identity_id_hr}` : `ID_Sistema:${ex.account?.id_in_system_account}`) || "Item Desconhecido";
            const itemIdentifier = item?.email_hr || item?.email_account || item?.cpf_hr || item?.cpf_account || (isIdentityEx ? ex.identity?.identity_id_hr : ex.account?.id_in_system_account) || "N/A";
            const systemName = ex.targetSystem || item?.system?.name_system || "N/A"; 
            
            const row = [
                `${itemName}\n(${itemIdentifier})`, 
                systemName,
                getDivergenceLabel(ex.divergenceCode),
                ex.user?.name || "N/A",
                ex.createdAt ? new Date(ex.createdAt).toLocaleDateString('pt-BR') : "N/A"
            ];
            tableRows.push(row);
        });

        doc.text("Relatório de Exceções de Divergência", 14, 15);
        autoTable(doc, {
             head: [tableColumns],
             body: tableRows,
             startY: 20,
             styles: { fontSize: 8 }, 
             headStyles: { fillColor: [22, 160, 133] }, 
        });
        doc.save("relatorio_excecoes.pdf");
    };

    const columns = useMemo(() => [
        {
            Header: "Item (Identidade/Conta)",
            accessor: row => { 
                 const isIdentityEx = row.type === 'Identity';
                 const item = isIdentityEx ? row.identity : row.account;
                 return item?.name_hr || item?.name_account || item?.email_hr || item?.email_account || row.id; 
            },
            id: 'itemDetail', 
            width: "25%",
            align: "left",
            Cell: ({ row: { original: ex } }) => {
                const isIdentityEx = ex.type === 'Identity';
                const item = isIdentityEx ? ex.identity : ex.account;
                
                const itemName = item?.name_hr || item?.name_account || (isIdentityEx ? `ID_RH:${ex.identity?.identity_id_hr}` : `ID_Sistema:${ex.account?.id_in_system_account}`) || "Item Desconhecido";
                const itemEmail = item?.email_hr || item?.email_account;
                const itemCpf = item?.cpf_hr || item?.cpf_account; 
                const systemName = ex.targetSystem || item?.system?.name_system || "N/A"; 
                
                let secondaryIdentifier = itemEmail || itemCpf || (isIdentityEx ? ex.identity?.identity_id_hr : ex.account?.id_in_system_account) || "";

                return (
                    <MDBox 
                        lineHeight={1} 
                        onClick={() => handleOpenDetailsModal(ex)} 
                        sx={{ cursor: "pointer", "&:hover > .MuiTypography-button": { textDecoration: "underline", color: "info.main" } }}
                    >
                        <MDTypography display="block" variant="button" fontWeight="medium">
                            {itemName} {isIdentityEx ? "(Identidade RH)" : `(Conta ${systemName})`}
                        </MDTypography>
                        {secondaryIdentifier && ( 
                            <MDTypography variant="caption">
                                {secondaryIdentifier}
                            </MDTypography>
                        )}
                    </MDBox>
                );
            },
        },
        { Header: "Tipo de Divergência", accessor: "divergenceCode", align: "center", Cell: ({ value }) => <MDTypography variant="caption" fontWeight="medium">{getDivergenceLabel(value)}</MDTypography> },
        { Header: "Justificativa", accessor: "justification", align: "left", Cell: ({ value }) => <MDTypography variant="caption" sx={{ display: 'block', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxWidth: '250px' }}>{value}</MDTypography> }, 
        { Header: "Aprovado Por", accessor: "user.name", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value || "N/A"}</MDTypography> },
        { Header: "Data", accessor: "createdAt", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value ? new Date(value).toLocaleDateString('pt-BR') : "N/A"}</MDTypography> },
        { 
            Header: "Ações", 
            accessor: "actions", 
            id: 'actions', 
            align: "center",
            disableSortBy: true,
            Cell: ({ row: { original: ex } }) => (
                <MDButton variant="text" color="error" onClick={() => handleOpenDeleteDialog(ex)} title="Reativar Monitoramento"> 
                    <Icon>delete_forever</Icon>&nbsp;Reativar
                </MDButton>
            )
        },
    ], [exceptions, getDivergenceLabel]); 

    const rows = useMemo(() => Array.isArray(exceptions) ? exceptions : [], [exceptions]);

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
                                    Gerenciamento de Exceções
                                </MDTypography>
                                <MDBox>
                                    <MDButton
                                        variant="gradient"
                                        color="error"
                                        onClick={handleOpenBulkDeleteDialog}
                                        disabled={exceptions.length === 0 || isLoading}
                                        sx={{ mr: 1 }}
                                        title="Reativar monitoramento para todas as exceções listadas"
                                    >
                                        <Icon>delete_sweep</Icon>&nbsp;Reativar Todas
                                    </MDButton>
                                    <MDButton variant="gradient" color="dark" onClick={openExportMenu} disabled={exceptions.length === 0 || isLoading}>
                                        <Icon>download</Icon>
                                        &nbsp;Exportar Relatório
                                    </MDButton>
                                </MDBox>
                            </MDBox>
                            <MDBox pt={3}>
                                <DataTable
                                    table={{ columns, rows }}
                                    isSorted={true} 
                                    entriesPerPage={{ defaultValue: 10, entries: [10, 25, 50, 100] }} 
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
            
            {detailsModalState.isOpen && (
                 <ExceptionDetailsModal 
                    open={detailsModalState.isOpen}
                    onClose={handleCloseDetailsModal}
                    isLoading={detailsModalState.isLoading}
                    details={detailsModalState.data}
                    getDivergenceLabel={getDivergenceLabel}
                    darkMode={darkMode}
                 />
            )}

            <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
                <DialogTitle>Reativar Monitoramento de Risco</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Você tem certeza que deseja reativar o monitoramento para a divergência em "
                        <strong>
                            {exceptionToDelete?.type === 'Identity' 
                                ? (exceptionToDelete?.identity?.name_hr || exceptionToDelete?.identity?.email_hr || `ID ${exceptionToDelete?.identity?.id}`) 
                                : (exceptionToDelete?.account?.name_account || exceptionToDelete?.account?.id_in_system_account || `Conta ID ${exceptionToDelete?.account?.id}`) 
                            }
                        </strong>
                        "?
                        <br/><br/>
                        Isso removerá a exceção e a divergência voltará a ser exibida nos painéis, se ainda aplicável.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <MDButton onClick={handleCloseDeleteDialog} color="secondary">Cancelar</MDButton>
                    <MDButton onClick={handleConfirmDelete} color="error">Confirmar Reativação</MDButton>
                </DialogActions>
            </Dialog>
            
            <Dialog open={bulkDeleteDialogOpen} onClose={handleCloseBulkDeleteDialog}>
                <DialogTitle>Reativar Monitoramento de Todos os Riscos</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Você tem certeza que deseja reativar <strong>TODAS as {exceptions.length}</strong> exceções listadas?
                        <br/><br/>
                        Esta ação não pode ser desfeita e todas as divergências voltarão a ser exibidas nos painéis, se ainda aplicáveis.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <MDButton onClick={handleCloseBulkDeleteDialog} color="secondary">Cancelar</MDButton>
                    <MDButton onClick={handleConfirmBulkDelete} color="error">Confirmar e Reativar Todas</MDButton>
                </DialogActions>
            </Dialog>
            
            <MDSnackbar
                color={notification.color} icon="notifications" title={notification.title}
                content={notification.content} dateTime="agora" open={notification.open}
                onClose={closeNotification} close={closeNotification}
            />

            <Menu
                anchorEl={exportMenu}
                open={Boolean(exportMenu)}
                onClose={closeExportMenu}
            >
                <MenuItem onClick={handleExportCsv}>
                    <Icon>description</Icon>&nbsp; Exportar como CSV
                </MenuItem>
                <MenuItem onClick={handleExportPdf}>
                    <Icon>picture_as_pdf</Icon>&nbsp; Exportar como PDF
                </MenuItem>
            </Menu>
        </DashboardLayout>
    );
}

export default GerenciarExcecoes;