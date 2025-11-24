// material-react-app/src/layouts/observabilidade/importManagement/index.js

import { useState, useEffect } from "react";
import axios from "axios";
import { useMaterialUIController } from "context";

// @mui material components
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import MDAlert from "components/MDAlert";
import Card from "@mui/material/Card";
import Modal from "@mui/material/Modal";
import Divider from "@mui/material/Divider";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDSnackbar from "components/MDSnackbar";
import PropTypes from 'prop-types';

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";

// --- NOVOS COMPONENTES FILHOS ---
import HistoryTable from "./components/HistoryTable";
import ImportCard from "./components/ImportCard";


// --- Componentes auxiliares para os modais ---
const ColumnDetail = ({ name, description, example }) => (
  <MDBox mb={2}>
    <MDTypography variant="button" fontWeight="bold" color="info" textGradient sx={{ fontFamily: 'monospace' }}>
      {name}
    </MDTypography>
    <MDTypography variant="body2" color="text" display="block" sx={{ mt: 0.5 }}>
      {description}
    </MDTypography>
    <MDTypography variant="caption" color="text" display="block" sx={{ fontFamily: 'monospace', mt: 0.5 }}>
      Exemplo: {example}
    </MDTypography>
  </MDBox>
);
ColumnDetail.propTypes = { name: PropTypes.string.isRequired, description: PropTypes.string.isRequired, example: PropTypes.string.isRequired };

function DetailItem({ icon, label, value, children, darkMode }) {
  const valueColor = darkMode ? "white" : "text.secondary";
  return (
    <MDBox display="flex" alignItems="center" mb={1.5} lineHeight={1}>
      <Icon color="secondary" fontSize="small" sx={{ mr: 1.5 }}>{icon}</Icon>
      <MDTypography variant="button" fontWeight="bold" color="text">{label}:&nbsp;</MDTypography>
      {value != null && value !== '' && (<MDTypography variant="button" fontWeight="regular" color={valueColor}>{value}</MDTypography>)}
      {!value && value !== false && !children && (<MDTypography variant="button" fontWeight="regular" color={valueColor}>N/A</MDTypography>)}
      {children}
    </MDBox>
  );
}
DetailItem.propTypes = { icon: PropTypes.string.isRequired, label: PropTypes.string.isRequired, value: PropTypes.any, children: PropTypes.node, darkMode: PropTypes.bool };
DetailItem.defaultProps = { darkMode: false, value: null, children: null };
// --- Fim dos Componentes Auxiliares ---


const statusMap = {
    SUCCESS: { text: "SUCESSO", color: "success" },
    FAILED: { text: "FALHA", color: "error" },
    PENDING: { text: "PENDENTE", color: "warning" },
    PROCESSING: { text: "PROCESSANDO", color: "info" },
};

// --- Componente Principal (Pai/Orquestrador) ---
function ImportManagement() {
    const [controller] = useMaterialUIController();
    const { token, darkMode } = controller;

    const [history, setHistory] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(true);
    const [isProcessing, setIsProcessing] = useState(false); 
    
    const [allDataSources, setAllDataSources] = useState([]); 
    const [loadingDataSources, setLoadingDataSources] = useState(true);

    const [notification, setNotification] = useState({ open: false, color: "info", title: "", content: "" });

    // Estados dos Modais
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [logToDelete, setLogToDelete] = useState(null);
    const [detailsModalOpen, setDetailsModalOpen] = useState(false);
    const [selectedLogDetails, setSelectedLogDetails] = useState(null);
    const [templateModalOpen, setTemplateModalOpen] = useState(false);

    const fetchDataSources = async () => {
        if (!token) {
           setAllDataSources([]);
           setLoadingDataSources(false); 
           return;
        }
        setLoadingDataSources(true);
        try {
            const response = await axios.get('/systems', { headers: { "Authorization": `Bearer ${token}` } });
            setAllDataSources(response.data);
        } catch (error) {
            console.error("Erro ao buscar a lista de fontes de dados:", error);
            setAllDataSources([]);
            setNotification({ open: true, color: "error", title: "Erro", content: "Não foi possível carregar as fontes de dados para importação." });
        } finally {
            setLoadingDataSources(false);
        }
    };

    const fetchHistory = async () => {
        if (!token) {
           setIsLoadingHistory(false);
           return;
        }
        setIsLoadingHistory(true);
        try {
            const response = await axios.get('/imports', { headers: { "Authorization": `Bearer ${token}` } });
            setHistory(response.data);
        } catch (error) {
            console.error("Fetch History Error:", error);
            setNotification({ open: true, color: "error", icon: "error", title: "Erro de Rede", content: "Falha ao buscar o histórico." });
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (token) {
            Promise.all([
                fetchHistory(),
                fetchDataSources()
            ]);
        } else {
             setIsLoadingHistory(false);
             setLoadingDataSources(false);
             setAllDataSources([]);
             setHistory([]);
        }
    }, [token]);


    const handleProcessUpload = async (file, dataSourceId, processingTarget, callback) => {
      setIsProcessing(true);
      const formData = new FormData();
      formData.append("csvFile", file);
      formData.append("dataSourceId", dataSourceId);
      formData.append("processingTarget", processingTarget); 

      try {
        const response = await axios.post('/imports/upload', formData, { 
          headers: { 
            'Content-Type': 'multipart/form-data', 
            'Authorization': `Bearer ${token}` 
          } 
        });
        
        handleProcessSuccess(response.data, callback);
      } catch (error) {
        handleProcessError(error, callback);
      } finally {
        setIsProcessing(false);
      }
    };

    // ======================= INÍCIO DA ALTERAÇÃO (Função de Disparo Unificada) =======================
    // Esta função decide qual rota chamar com base na configuração da fonte
    const handleTriggerProcessing = async (dataSourceId, processingTarget, callback) => {
      setIsProcessing(true);
      
      // 1. Encontra a fonte para saber o tipo
      const source = allDataSources.find(ds => ds.id === dataSourceId);
      if (!source) {
          handleProcessError({ response: { data: { message: "Fonte não encontrada no frontend." } } }, callback);
          setIsProcessing(false);
          return;
      }

      // 2. Determina o tipo (CSV ou DATABASE)
      let type = 'CSV'; // Default
      if (source.origem_datasource === 'RH') {
           // Se tiver config de DB, é DB
           if (source.hrConfig?.db_host || source.hrConfig?.db_url) type = 'DATABASE';
      } else if (source.origem_datasource === 'SISTEMA' && source.systemConfig) {
           // Se SISTEMA, olha a config específica
           type = processingTarget === 'CONTAS' 
              ? source.systemConfig.tipo_fonte_contas 
              : source.systemConfig.tipo_fonte_recursos;
      }

      // 3. Escolhe a URL correta (Segregada)
      const url = (type === 'DATABASE') 
         ? '/imports/sync-db' 
         : '/imports/process-directory';

      try {
        const response = await axios.post(url, { dataSourceId, processingTarget }, { 
          headers: { 'Authorization': `Bearer ${token}` } 
        });
        
        handleProcessSuccess(response.data, callback);
      } catch (error) {
        handleProcessError(error, callback);
      } finally {
        setIsProcessing(false);
      }
    };
    // ======================== FIM DA ALTERAÇÃO =========================
    
    // Funções helper para tratar a resposta
    const handleProcessSuccess = (importLog, callback) => {
      let statusTitle = "Processamento Concluído";
      let statusColor = "success";

      if (importLog.status === "FAILED") {
          statusTitle = "Falha no Processamento";
          statusColor = "error";
      } else if (importLog.status === "SUCCESS" && importLog.errorDetails) {
            statusTitle = "Processado com Avisos";
            statusColor = "warning";
      }

      setNotification({ 
          open: true, 
          color: statusColor, 
          icon: statusColor === "success" ? "check" : "warning", 
          title: statusTitle, 
          content: `Fonte: ${importLog.dataSource?.name_datasource || 'Fonte'}. ${importLog.processedRows}/${importLog.totalRows} registros processados.` 
      });
      
      if (callback) callback();
      fetchHistory();
    };
    
    const handleProcessError = (error, callback) => {
      console.error("Erro ao processar:", error);
      fetchHistory();
      const errorMessage = error.response?.data?.message || "Falha ao iniciar o processamento.";
      setNotification({ open: true, color: "error", icon: "error", title: "Erro no Processamento", content: errorMessage });
      if (callback) callback(true); 
    };

    const handleOpenDeleteDialog = (id) => { setLogToDelete(id); setDeleteDialogOpen(true); };
    const handleCloseDeleteDialog = () => { setLogToDelete(null); setDeleteDialogOpen(false); };
    const handleConfirmDelete = async () => { 
        if (!logToDelete) return;
        try {
            await axios.delete(`/imports/${logToDelete}`, { headers: { "Authorization": `Bearer ${token}` } });
            setNotification({ open: true, color: "success", icon: "check", title: "Sucesso", content: "Registro de importação excluído." });
            fetchHistory();
        } catch (error) {
            console.error("Delete Error:", error);
            const errorMessage = error.response?.data?.message || "Falha ao excluir o registro.";
            setNotification({ open: true, color: "error", icon: "error", title: "Erro", content: errorMessage });
        } finally {
            handleCloseDeleteDialog();
        }
    };

    const handleOpenDetailsModal = (log) => { setSelectedLogDetails(log); setDetailsModalOpen(true); };
    const handleCloseDetailsModal = () => { setSelectedLogDetails(null); setDetailsModalOpen(false); };

    const closeNotification = () => setNotification({ ...notification, open: false });
    const handleOpenTemplateModal = () => setTemplateModalOpen(true);
    const handleCloseTemplateModal = () => setTemplateModalOpen(false);
    
    return (
        <DashboardLayout>
            <DashboardNavbar />
            <MDBox pt={6} pb={3}>
                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <ImportCard
                            onProcessUpload={handleProcessUpload}
                            // Passa a nova função inteligente
                            onProcessDirectory={handleTriggerProcessing}
                            dataSourceOptions={allDataSources} 
                            history={history}
                            isLoading={isProcessing || loadingDataSources}
                            onOpenTemplate={handleOpenTemplateModal}
                        />
                    </Grid>

                    <HistoryTable
                        history={history}
                        isLoading={isLoadingHistory}
                        onOpenDetails={handleOpenDetailsModal}
                        onOpenDelete={handleOpenDeleteDialog}
                    />
                </Grid>
            </MDBox>

            {/* --- Seção de Modais --- */}
            <Dialog open={deleteDialogOpen} onClose={handleCloseDeleteDialog}>
              <DialogTitle>Confirmar Exclusão</DialogTitle>
              <DialogContent><DialogContentText>Você tem certeza que deseja excluir este registro de importação? Esta ação não pode ser desfeita.</DialogContentText></DialogContent>
              <DialogActions>
                <MDButton onClick={handleCloseDeleteDialog} color="secondary">Cancelar</MDButton>
                <MDButton onClick={handleConfirmDelete} color="error" autoFocus>Excluir</MDButton>
              </DialogActions>
            </Dialog>

            <Dialog open={templateModalOpen} onClose={handleCloseTemplateModal} fullWidth maxWidth="md">
                <DialogTitle sx={{ p: 2 }}>
                  <MDTypography variant="h5">Processamento de Dados</MDTypography>
                </DialogTitle>
                <DialogContent dividers sx={{ p: 3, borderTop: "none" }}>
                    <MDTypography variant="body2" color="text">
                        O processamento de dados é feito com base no mapeamento de colunas definido 
                        para cada Fonte de Dados.
                        <br/><br/>
                        1. Vá para <MDTypography component="strong" variant="body2">Observabilidade &gt; Fonte de Dados</MDTypography> para cadastrar sua fonte (CSV ou Banco).
                        <br/>
                        2. Vá para <MDTypography component="strong" variant="body2">Observabilidade &gt; Mapeamento de Dados</MDTypography> para configurar o "de-para" das colunas.
                        <br/>
                        3. Volte para esta página, selecione a fonte configurada e clique em "Processar" ou "Sincronizar Agora".
                    </MDTypography>
                </DialogContent>
                 <DialogActions sx={{ p: 2, justifyContent: 'flex-end' }}>
                  <MDButton onClick={handleCloseTemplateModal} color="info"> Fechar </MDButton>
                </DialogActions>
            </Dialog>

            {selectedLogDetails && (() => {
                const startTime = new Date(selectedLogDetails.createdAt);
                const endTime = selectedLogDetails.completedAt ? new Date(selectedLogDetails.completedAt) : null;
                let duration = "Em andamento...";
                if (endTime) {
                    const diffSeconds = (endTime.getTime() - startTime.getTime()) / 1000;
                    duration = `${diffSeconds.toFixed(2)} segundos`;
                }
                const statusInfo = statusMap[selectedLogDetails.status] || { text: selectedLogDetails.status, color: "secondary" };

                return (
                    <Modal open={detailsModalOpen} onClose={handleCloseDetailsModal} sx={{ display: "grid", placeItems: "center" }}>
                        <Card sx={{ width: "90%", maxWidth: "800px", maxHeight: "90vh", overflowY: "auto" }}>
                            <MDBox p={2} display="flex" justifyContent="space-between" alignItems="center">
                                <MDTypography variant="h5">Detalhes da Importação #{selectedLogDetails.id}</MDTypography>
                                <Icon
                                    sx={({ typography: { size }, palette: { dark, white } }) => ({
                                        fontSize: `${size.lg} !important`,
                                        color: darkMode ? white.main : dark.main,
                                        stroke: "currentColor",
                                        strokeWidth: "2px",
                                        cursor: "pointer",
                                    })}
                                    onClick={handleCloseDetailsModal}
                                >
                                    close
                                </Icon>
                            </MDBox>

                            <MDBox p={3} pt={1}>
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <DetailItem icon="badge" label="Usuário" value={selectedLogDetails.user?.name} darkMode={darkMode} />
                                        <DetailItem icon="storage" label="Fonte de Dados" value={selectedLogDetails.dataSource?.name_datasource} darkMode={darkMode} />
                                        <DetailItem icon="description" label="Arquivo/Tabela" value={selectedLogDetails.fileName} darkMode={darkMode} />
                                        <DetailItem icon="numbers" label="Registros" value={`${selectedLogDetails.processedRows} / ${selectedLogDetails.totalRows}`} darkMode={darkMode} />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <DetailItem icon="play_arrow" label="Início" value={startTime.toLocaleString('pt-BR')} darkMode={darkMode} />
                                        <DetailItem icon="check_circle" label="Término" value={endTime ? endTime.toLocaleString('pt-BR') : ""} darkMode={darkMode} />
                                        <DetailItem icon="timer" label="Duração" value={duration} darkMode={darkMode} />
                                        <DetailItem icon="task_alt" label="Status" darkMode={darkMode}>
                                            <MDBadge badgeContent={statusInfo.text} color={statusInfo.color} size="sm" variant="gradient" container sx={{ ml: 1 }}/>
                                        </DetailItem>
                                    </Grid>
                                </Grid>

                                {selectedLogDetails.status === "FAILED" && selectedLogDetails.errorDetails && (
                                    <>
                                        <Divider sx={{ my: 2 }} />
                                        <MDAlert color="error" sx={{ mt: 1 }}>
                                            <MDTypography variant="button" color="white" sx={{ whiteSpace: "pre-wrap" }}>
                                                <strong>Detalhes do Erro:</strong><br/>{selectedLogDetails.errorDetails}
                                            </MDTypography>
                                        </MDAlert>
                                    </>
                                )}
                            </MDBox>
                        </Card>
                    </Modal>
                );
            })()}

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

export default ImportManagement;