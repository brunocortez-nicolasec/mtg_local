// material-react-app/src/layouts/observabilidade/geral/index.js

import React, { useEffect, useState, useMemo } from "react";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import axios from "axios";
import { useMaterialUIController } from "context"; 

// Componentes do Template
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Grid from "@mui/material/Grid";
import Modal from "@mui/material/Modal";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import { Box } from "@mui/material";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import CircularProgress from "@mui/material/CircularProgress";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import DataTable from "examples/Tables/DataTable";
import colors from "assets/theme/base/colors";
import MDBadge from "components/MDBadge";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import MDSnackbar from "components/MDSnackbar";

// Componentes do Template
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// Componentes locais
import LiveFeed from "./components/LiveFeed";
import Painel from "./components/Painel";
import RisksChartCard from "./components/RisksChartCard";
import useDashboardData from "./hooks/useDashboardData";
import FinancialCards from "./components/FinancialCards";
import RiskAnalysisWidgets from "./components/RiskAnalysisWidgets";
import KpiStack from "./components/KpiStack";

// --- COMPONENTES DE MODAL (Mantidos e Blindados) ---

const ModalContent = React.forwardRef(({ title, data, onClose, darkMode }, ref) => (
    <Box ref={ref} tabIndex={-1}>
        <Card sx={{ width: "80vw", maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}>
            <MDBox p={2} display="flex" justifyContent="space-between" alignItems="center">
                <MDTypography variant="h6">{title}</MDTypography>
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
            <MDBox p={2} pt={0}>
                <DataTable table={data} isSorted={false} entriesPerPage={{ defaultValue: 10, entries: [5, 10, 25] }} showTotalEntries canSearch />
            </MDBox>
        </Card>
    </Box>
));
ModalContent.propTypes = {
    title: PropTypes.string.isRequired,
    data: PropTypes.object.isRequired,
    onClose: PropTypes.func.isRequired,
    darkMode: PropTypes.bool,
};
ModalContent.defaultProps = { darkMode: false };
ModalContent.displayName = 'ModalContent';


const DrillDownModal = React.forwardRef(({ title, data, isLoading, onIgnore, onIgnoreAll, onClose, darkMode, divergenceCode }, ref) => {
    
    const columns = useMemo(() => {
        let cols = [
            { Header: "Nome", accessor: "name", Cell: ({ value }) => <MDTypography variant="caption">{value || '-'}</MDTypography> },
            { Header: "Sistema", accessor: "sourceSystem", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value}</MDTypography> },
        ];

        if (divergenceCode === 'ACCESS_NOT_GRANTED') {
            cols = [
                { Header: "Nome", accessor: "name", Cell: ({ value }) => <MDTypography variant="caption">{value || '-'}</MDTypography> },
                { Header: "Email", accessor: "email", Cell: ({ value }) => <MDTypography variant="caption">{value || '-'}</MDTypography> },
                { Header: "Sistema (Acesso Faltante)", accessor: "sourceSystem", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value}</MDTypography> },
                { Header: "Tipo (RH)", accessor: "userType", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value || "N/A"}</MDTypography> },
                { Header: "Status (RH)", accessor: "status", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value || "N/A"}</MDTypography> },
            ];
        } else if (divergenceCode === 'NAME_MISMATCH') {
            cols.push({ Header: "Nome (RH)", accessor: "rhData.name_hr", Cell: ({ value }) => <MDTypography variant="caption">{value || 'N/A'}</MDTypography> });
            cols.push({ Header: "Nome (App)", accessor: "appData.name_account", Cell: ({ value }) => <MDTypography variant="caption" color="error">{value || 'N/A'}</MDTypography> });
        
        } else if (divergenceCode === 'EMAIL_MISMATCH') {
            cols.push({ Header: "Email (RH)", accessor: "rhData.email_hr", Cell: ({ value }) => <MDTypography variant="caption">{value || 'N/A'}</MDTypography> });
            cols.push({ Header: "Email (App)", accessor: "appData.email_account", Cell: ({ value }) => <MDTypography variant="caption" color="error">{value || 'N/A'}</MDTypography> });

        } else if (divergenceCode === 'CPF_MISMATCH') {
            cols.push({ Header: "CPF (RH)", accessor: "rhData.cpf_hr", Cell: ({ value }) => <MDTypography variant="caption">{value || 'N/A'}</MDTypography> });
            cols.push({ Header: "CPF (App)", accessor: "appData.cpf_account", Cell: ({ value }) => <MDTypography variant="caption" color="error">{value || 'N/A'}</MDTypography> });
        
        } else {
            cols.push({ Header: "Email", accessor: "email", Cell: ({ value }) => <MDTypography variant="caption">{value || '-'}</MDTypography> });
            cols.push({ Header: "Perfil (App)", accessor: "profile", align: "center", Cell: ({ value }) => <MDTypography variant="caption">{value || "N/A"}</MDTypography> });
            cols.push({ 
                Header: "Status (App)", 
                accessor: "status", 
                align: "center", 
                Cell: ({ value }) => (
                    value ? 
                    <MDBadge 
                        badgeContent={value} 
                        color={value.toLowerCase() === 'ativo' ? 'success' : 'error'} 
                        variant="gradient" 
                        size="sm" 
                    /> : 
                    <MDTypography variant="caption">-</MDTypography>
                )
             });
        }
        
        cols.push({ Header: "Ações", accessor: "id", align: "center", disableGlobalFilter: true,
            Cell: ({ row }) => (
                <MDButton variant="gradient" color="success" size="small" onClick={() => onIgnore(row.original)}>Ignorar</MDButton>
            )
        });
        
        return cols;
    }, [data, divergenceCode, onIgnore]);

    // Blindagem: Garante que 'data' seja array
    const safeData = Array.isArray(data) ? data : [];

    return (
        <Box ref={ref} tabIndex={-1}>
            <Card sx={{ width: "80vw", maxWidth: "900px", maxHeight: "90vh", overflowY: "auto" }}>
                <MDBox p={2} display="flex" justifyContent="space-between" alignItems="center">
                    <MDTypography variant="h6">{title}</MDTypography>
                    <MDBox display="flex" alignItems="center">
                        {safeData.length > 0 && !isLoading && (
                            <MDButton variant="gradient" color="info" size="small" onClick={onIgnoreAll} sx={{ mr: 2 }}>
                                Ignorar Todos
                            </MDButton>
                        )}
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
                </MDBox>
                <MDBox p={2} pt={0}>
                    {isLoading ? (
                        <MDBox display="flex" justifyContent="center" alignItems="center" sx={{ minHeight: '200px' }}><CircularProgress color="info" /></MDBox>
                    ) : (
                        <DataTable table={{ columns, rows: safeData }} isSorted={false} entriesPerPage={{ defaultValue: 5 }} showTotalEntries canSearch />
                    )}
                </MDBox>
            </Card>
        </Box>
    );
});

DrillDownModal.propTypes = {
    title: PropTypes.string.isRequired,
    data: PropTypes.array.isRequired,
    isLoading: PropTypes.bool.isRequired,
    onIgnore: PropTypes.func.isRequired,
    onIgnoreAll: PropTypes.func.isRequired,
    onClose: PropTypes.func.isRequired,
    darkMode: PropTypes.bool,
    divergenceCode: PropTypes.string,
};
DrillDownModal.defaultProps = {
    darkMode: false,
    divergenceCode: '',
};
DrillDownModal.displayName = 'DrillDownModal';


const JustificationModal = ({ open, onClose, onSubmit }) => {
    const [justification, setJustification] = useState("");
    const handleSubmit = () => { onSubmit(justification); setJustification(""); };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Justificar Exceção</DialogTitle>
            <DialogContent>
                <DialogContentText sx={{ mb: 2 }}>
                    Por favor, forneça uma justificativa para ignorar esta divergência. Esta ação será registrada para fins de auditoria.
                </DialogContentText>
                <TextField autoFocus margin="dense" id="justification" label="Justificativa" type="text" fullWidth multiline rows={4} variant="outlined" value={justification} onChange={(e) => setJustification(e.target.value)} />
            </DialogContent>
            <DialogActions>
                <MDButton onClick={onClose} color="secondary">Cancelar</MDButton>
                <MDButton onClick={handleSubmit} color="info" variant="gradient" disabled={!justification.trim()}>Salvar Exceção</MDButton>
            </DialogActions>
        </Dialog>
    );
};
JustificationModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
};


function VisaoGeral() {
    const [controller] = useMaterialUIController();
    const { token, darkMode } = controller;

    const [plataformaSelecionada, setPlataformaSelecionada] = useState("Geral");
    const [metrics, setMetrics] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [liveFeedData, setLiveFeedData] = useState([]);
    
    const [drillDownState, setDrillDownState] = useState({ isOpen: false, isLoading: false, title: "", data: [], code: "" });
    const [exceptionState, setExceptionState] = useState({ isOpen: false, item: null, isBulk: false });
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalContent, setModalContent] = useState({ title: "", data: { columns: [], rows: [] } });
    const [isBulkConfirmOpen, setIsBulkConfirmOpen] = useState(false);
    
    const [notification, setNotification] = useState({ open: false, color: "info", title: "", content: "" });
    const closeNotification = () => setNotification({ ...notification, open: false });

    const API_URL = process.env.REACT_APP_API_URL;

    const api = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${token}` },
    });

    const fetchDashboardData = async () => {
        if (!token) return;
        setIsLoading(true);
        
        const metricsPromise = api.get(`/metrics/${plataformaSelecionada}?_=${new Date().getTime()}`);
        const liveFeedParams = { system: plataformaSelecionada.toLowerCase() === 'geral' ? undefined : plataformaSelecionada };
        const liveFeedPromise = api.get('/live-feed', { params: liveFeedParams });
        
        try {
            const [metricsResponse, liveFeedResponse] = await Promise.all([metricsPromise, liveFeedPromise]);
            setMetrics(metricsResponse.data);
            // Blindagem
            setLiveFeedData(Array.isArray(liveFeedResponse.data) ? liveFeedResponse.data : []);
        } catch (error) {
            console.error("Erro ao buscar dados do dashboard:", error);
            setMetrics(null);
            setLiveFeedData([]);
            setNotification({ open: true, color: "error", title: "Erro de Rede", content: "Não foi possível carregar os dados do painel." });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (token) {
            fetchDashboardData();
        }
    }, [plataformaSelecionada, token]);

    // Hook (já blindado anteriormente)
    const displayData = useDashboardData(metrics, isLoading);
    
    const handlePlatformChange = (plataforma) => setPlataformaSelecionada(plataforma);
    const handleOpenModal = () => setIsModalOpen(true);
    const handleCloseModal = () => setIsModalOpen(false);

    const handleKpiItemClick = async (code, title) => {
        setDrillDownState({ isOpen: true, isLoading: true, title: `Detalhes: ${title}`, data: [], code });
        try {
            const response = await api.get(`/divergences/by-code/${code}`, {
                params: { system: plataformaSelecionada === 'Geral' ? undefined : plataformaSelecionada }
            });
            // Blindagem
            const data = Array.isArray(response.data) ? response.data : [];
            setDrillDownState(prev => ({ ...prev, isLoading: false, data: data }));
        } catch (error) {
            console.error("Erro ao buscar detalhes da divergência:", error);
            setDrillDownState(prev => ({ ...prev, isLoading: false }));
        }
    };

    const handleCloseDrillDownModal = () => setDrillDownState({ isOpen: false, isLoading: false, title: "", data: [], code: "" });
    
    const handleOpenExceptionModal = (item) => {
        setExceptionState({ isOpen: true, item, isBulk: false });
    };
    
    const handleCloseExceptionModal = () => setExceptionState({ isOpen: false, item: null, isBulk: false });

    const handleOpenBulkConfirm = () => setIsBulkConfirmOpen(true);
    const handleCloseBulkConfirm = () => setIsBulkConfirmOpen(false);
    
    const handleConfirmBulkIgnore = () => {
        handleCloseBulkConfirm();
        setExceptionState({ isOpen: true, item: null, isBulk: true });
    };
    
    const handleConfirmException = async (justification) => {
        const { item, isBulk } = exceptionState;
        const { code, data } = drillDownState;
    
        if (!code || !justification) return;
    
        try {
            if (isBulk) {
                const payload = {
                    divergenceCode: code,
                    justification,
                };
                
                if (code === 'ACCESS_NOT_GRANTED') {
                    const groupedBySystem = data.reduce((acc, item) => {
                        const system = item.sourceSystem;
                        if (!acc[system]) acc[system] = [];
                        
                        const originalId = parseInt(String(item.id).split('-')[0], 10);

                        if (!isNaN(originalId)) {
                            acc[system].push(originalId);
                        }
                        return acc;
                    }, {});

                    const promises = Object.entries(groupedBySystem).map(([system, ids]) => {
                        if (ids.length === 0) return Promise.resolve();
                        return api.post('/divergences/exceptions/bulk', 
                            { ...payload, identityIds: ids, targetSystem: system }
                        );
                    });
                    await Promise.all(promises);
                    
                } else {
                    const accountIds = data.map(item => item.id);
                    if (accountIds.length === 0) return;
                    
                    payload.accountIds = accountIds;
                    await api.post('/divergences/exceptions/bulk', payload);
                }

            } else {
                if (!item) return;

                const payload = {
                    divergenceCode: code,
                    justification,
                };

                if (code === 'ACCESS_NOT_GRANTED') {
                    const identityId = parseInt(String(item.id).split('-')[0], 10);
                    if (isNaN(identityId)) throw new Error("ID da identidade inválido.");
                    
                    payload.identityId = identityId;
                    payload.targetSystem = item.sourceSystem;
                } else {
                    payload.accountId = item.id;
                }
                
                await api.post('/divergences/exceptions', payload);
            }
            
            setNotification({ open: true, color: "success", title: "Sucesso", content: "Exceção(ões) registrada(s)." });
            handleCloseExceptionModal();
            handleCloseDrillDownModal();
            fetchDashboardData();
    
        } catch (error) {
            console.error("Erro ao criar exceção(ões):", error);
            const message = error.response?.data?.message || error.message || "Não foi possível registrar a exceção.";
            setNotification({ open: true, color: "error", title: "Erro", content: message });
        }
    };

    const handleFinancialCardClick = (cardType) => {
        const breakdownData = metrics?.riscos?.prejuizoBreakdown;
        if (!breakdownData) { return; }
        const title = cardType === 'prejuizo' ? "Detalhes do Cálculo de Prejuízo Potencial" : "Detalhes do Cálculo de Valor Mitigado";
        
        const columns = [ { Header: "Tipo de Risco", accessor: "label" }, { Header: "Quantidade", accessor: "count", align: "center" }, { Header: "Custo Unitário", accessor: "costPerUnit", align: "right" }, { Header: "Subtotal", accessor: "subTotal", align: "right" } ];
        const multiplier = cardType === 'mitigado' ? 0.95 : 1;
        
        const rows = breakdownData.filter(item => item.count > 0).map(item => ({
            label: <MDTypography variant="caption">{item.label}</MDTypography>,
            count: <MDTypography variant="caption" fontWeight="medium" sx={{textAlign: "center"}}>{item.count}</MDTypography>,
            costPerUnit: <MDTypography variant="caption" color="text" sx={{textAlign: "right"}}>{`R$ ${item.costPerUnit.toLocaleString('pt-BR')}`}</MDTypography>,
            subTotal: <MDTypography variant="caption" fontWeight="medium" color="error" sx={{textAlign: "right"}}>{`R$ ${(item.subTotal * multiplier).toLocaleString('pt-BR')}`}</MDTypography>,
        }));
        
        setModalContent({ title: title, data: { columns, rows } });
        handleOpenModal();
    };

    // --- CORREÇÃO NA LÓGICA DE FILTRAGEM DO GRÁFICO PIZZA ---
    const handlePieChartClick = (event, elements) => {
        if (!elements || elements.length === 0) return;
        const { index } = elements[0];
        const clickedLabel = displayData.imDisplay.tiposChart.labels[index];
        if (!clickedLabel) return;
    
        const usersOfType = liveFeedData.filter(item => {
            // Normaliza o tipo do item para bater com o rótulo do gráfico
            let itemType = item.userType;
            
            // Se for nulo, vazio ou "N/A" (como vem do backend), trata como "Não categorizado"
            if (!itemType || itemType === 'N/A' || itemType.trim() === '') {
                itemType = 'Não categorizado';
            }
            
            return itemType === clickedLabel && 
                   (item.app_status !== 'Não encontrado' || item.divergenceCode === 'ACCESS_NOT_GRANTED');
        });
    
        setModalContent({
            title: `Detalhes: Tipo de Usuário "${clickedLabel}"`,
            data: {
                columns: [
                    { Header: "ID no Sistema/RH", accessor: "id_user" },
                    { Header: "Nome", accessor: "name" },
                    { Header: "Email", accessor: "email" },
                    { Header: "Sistema", accessor: "sourceSystem" },
                    { Header: "Perfil", accessor: "perfil" },
                    { Header: "Status App", accessor: "app_status" },
                    { Header: "Status RH", accessor: "rh_status" },
                ],
                rows: usersOfType,
            },
        });
        handleOpenModal();
    };

    const handleBarChartClick = async (event, elements) => {
        if (!elements || elements.length === 0 || !token) return;
        const { index } = elements[0];
        const clickedLabel = displayData.riscosConsolidadosChart.labels[index];
        if (!clickedLabel) return;
        
        let columns = [];
        const modalTitle = `Detalhes: ${clickedLabel}`;
        let rowsToShow = [];
        
        try {
            const requestParams = { 
                system: plataformaSelecionada === "Geral" ? undefined : plataformaSelecionada 
            };
            
            let endpointCode = "";

            switch (index) {
                case 0: // Contas Admin com Risco
                    rowsToShow = liveFeedData.filter(item => 
                        item.perfil.toLowerCase().includes('admin') && item.divergence
                    );
                    columns = [ { Header: "Sistema", accessor: "sourceSystem" }, { Header: "ID no Sistema", accessor: "id_user" }, { Header: "Nome", accessor: "name" }, { Header: "Status App", accessor: "app_status" }, { Header: "Status RH", accessor: "rh_status" } ];
                    break;
                
                case 1: // Acessos Ativos Indevidos (Zumbi)
                    endpointCode = 'ZOMBIE_ACCOUNT';
                    break;
                
                case 2: // Contas Órfãs
                    endpointCode = 'ORPHAN_ACCOUNT';
                    break;
                
                case 3: // Violações de SOD
                    endpointCode = 'SOD_VIOLATION';
                    break;

                default: 
                    return;
            }

            if (endpointCode) {
                 const response = await api.get(`/divergences/by-code/${endpointCode}`, { 
                     params: requestParams 
                 });
                 // Blindagem
                 rowsToShow = Array.isArray(response.data) ? response.data : [];
                 
                 columns = [
                     { Header: "Sistema", accessor: "sourceSystem" },
                     { Header: "ID no Sistema", accessor: "id_in_system_account" },
                     { Header: "Nome", accessor: "name" }, 
                     { Header: "Email", accessor: "email" },
                     { Header: "Perfis", accessor: "profile" } 
                 ];

                 if (endpointCode === 'SOD_VIOLATION') {
                     columns[4].Header = "Perfis (Conflitantes)";
                 }
            }
            
            setModalContent({ title: modalTitle, data: { columns, rows: rowsToShow } });
            handleOpenModal();
        } catch (error) {
            console.error(`Erro ao buscar detalhes para '${clickedLabel}':`, error);
        }
    };

    const hasRiskInChart = useMemo(() => {
        if (!displayData || !displayData.riscosConsolidadosChart.datasets[0]) {
            return false;
        }
        return displayData.riscosConsolidadosChart.datasets[0].data.some(value => value > 0);
    }, [displayData]);

    const convertToCSV = (objArray) => {
      const array = typeof objArray !== 'object' ? JSON.parse(objArray) : objArray;
      let str = '';
 
      const headers = [
        { id: "id_user", title: "ID no Sistema/RH" },
        { id: "name", title: "Nome" },
        { id: "email", title: "Email" },
        { id: "sourceSystem", title: "Sistema" },
        { id: "perfil", title: "Perfil" },
        { id: "app_status", title: "Status App" },
        { id: "rh_status", title: "Status RH" },
        { id: "userType", title: "Tipo (RH)" },
        { id: "divergence", title: "Divergência" },
      ];
      
      str += headers.map(h => `"${h.title}"`).join(',') + '\r\n';
 
      for (let i = 0; i < array.length; i++) {
        let line = '';
        for (let j = 0; j < headers.length; j++) {
          if (line !== '') line += ',';
          
          let value = array[i][headers[j].id];
          
          if (value === null || value === undefined) {
            value = "";
          }
          
          line += `"${String(value).replace(/"/g, '""')}"`;
        }
        str += line + '\r\n';
      }
      return str;
    };
 
    const handleExportCsv = () => {
      closeExportMenu();
      
      if (!liveFeedData || liveFeedData.length === 0) {
        setNotification({ open: true, color: "warning", title: "Exportação", content: "Não há dados para exportar." });
        return;
      }
 
      try {
        const csvData = convertToCSV(liveFeedData);
        const blob = new Blob([`\uFEFF${csvData}`], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        
        link.setAttribute("href", url);
        link.setAttribute("download", "visão_geral_export.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
 
        setNotification({ open: true, color: "success", title: "Exportação", content: "Download do CSV iniciado." });
 
      } catch (error) {
        console.error("Erro ao gerar CSV:", error);
        setNotification({ open: true, color: "error", title: "Erro", content: "Não foi possível gerar o arquivo CSV." });
      }
    };
 
    const handleExportPdf = () => {
      closeExportMenu();
      
      setNotification({ open: true, color: "info", title: "Exportar PDF", content: "Use a opção 'Salvar como PDF' da janela de impressão." });
      
      setTimeout(() => {
        window.print();
      }, 500);
    };
 
    const [exportMenu, setExportMenu] = useState(null);
    const openExportMenu = (event) => setExportMenu(event.currentTarget);
    const closeExportMenu = () => setExportMenu(null);

    return (
        <DashboardLayout>
            <DashboardNavbar />
            
            <Modal open={drillDownState.isOpen} onClose={handleCloseDrillDownModal} sx={{ display: "grid", placeItems: "center" }}>
                <DrillDownModal 
                    title={drillDownState.title} 
                    data={drillDownState.data} 
                    isLoading={drillDownState.isLoading} 
                    onClose={handleCloseDrillDownModal} 
                    onIgnore={handleOpenExceptionModal}
                    onIgnoreAll={handleOpenBulkConfirm}
                    darkMode={darkMode}
                    divergenceCode={drillDownState.code}
                />
            </Modal>
    
            <JustificationModal open={exceptionState.isOpen} onClose={handleCloseExceptionModal} onSubmit={handleConfirmException} />
            
            <Dialog open={isBulkConfirmOpen} onClose={handleCloseBulkConfirm}>
                <DialogTitle>Confirmar Ação em Massa</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        Você tem certeza que deseja ignorar todas as <strong>{drillDownState.data.length}</strong> divergências deste tipo?
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <MDButton onClick={handleCloseBulkConfirm} color="secondary">Cancelar</MDButton>
                    <MDButton onClick={handleConfirmBulkIgnore} color="info" variant="gradient">Confirmar</MDButton>
                </DialogActions>
            </Dialog>

            <Modal open={isModalOpen} onClose={handleCloseModal} sx={{ display: "grid", placeItems: "center" }}>
                <ModalContent 
                    title={modalContent.title} 
                    data={modalContent.data} 
                    onClose={handleCloseModal} 
                    darkMode={darkMode}
                />
            </Modal>

            <MDBox py={3}>
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} lg={7}>
                        {displayData && (
                            <Painel imDisplay={displayData.imDisplay} onPieChartClick={handlePieChartClick} onPlatformChange={handlePlatformChange} selectedPlatform={plataformaSelecionada} />
                        )}
                    </Grid>
                    
                    <Grid item xs={12} lg={2}>
                        <Card sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
                             <MDBox p={2} pt={0} sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
                                 <Grid container spacing={2} sx={{ flexGrow: 1 }}>
                                     <Grid item xs={12} sx={{ display: 'flex' }}>
                                         <Card sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                             <MDBox p={1} textAlign="center">
                                                 <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>Índice de Conformidade</MDTypography>
                                                 <MDTypography 
                                                    variant="h2" 
                                                    fontWeight="bold" 
                                                    color={
                                                        displayData.indiceConformidade == 100 ? "success" : 
                                                        displayData.indiceConformidade < 90 ? "error" : "warning"
                                                    }
                                                 > 
                                                    {displayData.indiceConformidade}%
                                                 </MDTypography>
                                                 <MDTypography variant="body2" color="text" sx={{mb: 3}}>das identidades estão íntegras.</MDTypography>
                                             </MDBox>
                                         </Card>
                                     </Grid>
                                     <Grid item xs={12} sx={{ display: 'flex' }}>
                                         <Card sx={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                                             <MDBox p={1} textAlign="center">
                                                 <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>Riscos em Contas Privilegiadas</MDTypography>
                                                 <MDTypography variant="h2" fontWeight="bold" color={displayData.riscosEmContasPrivilegiadas > 0 ? "error" : "success"}>
                                                      {displayData.riscosEmContasPrivilegiadas}
                                                 </MDTypography>
                                                 <MDTypography variant="body2" color="text" sx={{mb: 3}}>contas admin com divergências.</MDTypography>
                                             </MDBox>
                                         </Card>
                                     </Grid>
                                 </Grid>
                             </MDBox>
                        </Card>
                    </Grid>

                    <FinancialCards 
                        prejuizoPotencial={displayData.prejuizoPotencial}
                        valorMitigado={displayData.prejuizoMitigado}
                        plataformaSelecionada={plataformaSelecionada}
                        onClick={handleFinancialCardClick}
                    />
                </Grid>
                
                <Grid container spacing={3} sx={{ mb: 3 }} alignItems="stretch">
                    <Grid item xs={12} sm={6} md={2}>
                        <RiskAnalysisWidgets 
                            title="Crítico" 
                            defaultColor="error" 
                            onItemClick={handleKpiItemClick}
                            items={[ 
                                { label: "Acessos Ativos Indevidos", value: displayData.imDisplay.divergencias.inativosRHAtivosApp ?? 0, code: 'ZOMBIE_ACCOUNT' },
                                { label: "Divergência de CPF", value: displayData.imDisplay.divergencias.cpf ?? 0, code: 'CPF_MISMATCH' },
                                { label: "Admins Dormentes", value: displayData.imDisplay.kpisAdicionais.adminsDormentes ?? 0, code: 'DORMANT_ADMIN' }
                            ]} 
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                        <RiskAnalysisWidgets 
                            title="Divergências" 
                            defaultColor="warning" 
                            onItemClick={handleKpiItemClick}
                            items={[ 
                                { label: "Acessos Previstos Não Concedidos", value: displayData.imDisplay.divergencias.acessoPrevistoNaoConcedido ?? 0, code: 'ACCESS_NOT_GRANTED' }, 
                                { label: "Divergência de Nome", value: displayData.imDisplay.divergencias.nome ?? 0, code: 'NAME_MISMATCH' }, 
                                { label: "Divergência de E-mail", value: displayData.imDisplay.divergencias.email ?? 0, code: 'EMAIL_MISMATCH' } 
                            ]} 
                        />
                    </Grid>
                    <Grid item xs={12} sm={6} md={2}>
                         <KpiStack 
                            title="Chamados" 
                            defaultColor="info" 
                            items={[ {label: "Fechados", value: 49}, {label: "Cancelados", value: 59}, {label: "Em espera", value: 2}, {label: "Em progresso", value: 2} ]}
                        />
                    </Grid>
                    
                    <Grid item xs={12} sm={6} md={6}>
                        <RisksChartCard 
                            chart={displayData.riscosConsolidadosChart}
                            onClick={handleBarChartClick}
                            hasRisk={hasRiskInChart} 
                        />
                    </Grid>
                </Grid>

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <LiveFeed data={liveFeedData} />
                    </Grid>
                </Grid>
            </MDBox>

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

export default VisaoGeral;