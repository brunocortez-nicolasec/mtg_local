// material-react-app/src/layouts/administrar/usuarios/index.js

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import Collapse from "@mui/material/Collapse";
import AddUserModal from "./components/AddUserModal";
import EditUserModal from "./components/EditUserModal";
import MDAlert from "components/MDAlert";
import AdminPageLayout from "layouts/administrar/components/AdminPageLayout";
import DataTable from "examples/Tables/DataTable";
import MDTypography from "components/MDTypography";
import MDBox from "components/MDBox";
import usersTableData from "./data/usersTableData";
import MDInput from "components/MDInput";

// Imports para o Modal de Reset
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";
import MDButton from "components/MDButton";
import Icon from "@mui/material/Icon";

function GerenciarUsuarios() {
    const [users, setUsers] = useState([]);
    const [notification, setNotification] = useState({ show: false, color: "info", message: "" });
    
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    
    // Estado para o Modal de Reset de Senha
    const [resetDialog, setResetDialog] = useState({ open: false, tempPassword: "", userName: "" });
    
    const [tableData, setTableData] = useState({ columns: [], rows: [] });
    const [loading, setLoading] = useState(true);
    const [searchText, setSearchText] = useState("");

    const API_URL = process.env.REACT_APP_API_URL;

    const api = axios.create({
        baseURL: API_URL,
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    });

    const fetchUsers = async () => {
        try {
            setLoading(true);
            const response = await api.get("/users");
            const data = response.data;
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Erro ao buscar usuários:", error);
            setUsers([]);
            setNotification({ show: true, color: "error", message: "Erro ao carregar usuários." });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (notification.show) {
            const timer = setTimeout(() => {
                setNotification((prevState) => ({ ...prevState, show: false }));
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const filteredUsers = useMemo(() =>
        users.filter(user =>
            user.name?.toLowerCase().includes(searchText.toLowerCase())
        ), [users, searchText]);

    useEffect(() => {
        // Passamos o handleResetUser para o data.js
        const formattedData = usersTableData(filteredUsers, handleEditClick, handleDeleteClick, handleResetUser);
        setTableData(formattedData);
    }, [filteredUsers]);

    const handleEditClick = (user) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };
    const handleCloseEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedUser(null);
    };
    const handleAddClick = () => {
        setIsAddModalOpen(true);
    };
    const handleCloseAddModal = () => {
        setIsAddModalOpen(false);
    };

    // --- NOVA FUNÇÃO: RESET DE SENHA ---
    const handleResetUser = async (user) => {
        if (!window.confirm(`Deseja resetar a senha do usuário ${user.name}?`)) return;

        try {
            const response = await api.post(`/users/${user.id}/reset-password`);
            const { tempPassword } = response.data;
            
            // Abre o modal com a senha
            setResetDialog({ open: true, tempPassword, userName: user.name });
            setNotification({ show: true, color: "success", message: "Senha resetada com sucesso!" });
        } catch (error) {
            console.error("Erro ao resetar senha:", error);
            setNotification({ show: true, color: "error", message: "Erro ao resetar senha." });
        }
    };
    
    const handleCloseResetDialog = () => {
        setResetDialog({ open: false, tempPassword: "", userName: "" });
    };

    const handleSaveUser = async (id, updatedData) => {
        try {
            await api.patch(`/users/${id}`, updatedData);
            setNotification({ show: true, color: "success", message: "Usuário atualizado com sucesso!" });
            fetchUsers();
            handleCloseEditModal();
        } catch (error) {
            console.error("Erro ao salvar usuário:", error);
            setNotification({ show: true, color: "error", message: error.response?.data?.message || "Erro ao salvar alterações." });
        }
    };

    const handleCreateUser = async (newUserData) => {
        try {
            await api.post("/users", newUserData);
            setNotification({ show: true, color: "success", message: "Usuário criado com sucesso!" });
            fetchUsers();
            handleCloseAddModal();
        } catch (error) {
            const message = error.response?.data?.message || "Erro ao criar o usuário.";
            console.error("Erro ao criar usuário:", error);
            setNotification({ show: true, color: "error", message });
        }
    };

    const handleDeleteClick = async (id) => {
        if (window.confirm("Tem certeza que deseja deletar este usuário?")) {
            try {
                await api.delete(`/users/${id}`);
                setNotification({ show: true, color: "success", message: "Usuário deletado com sucesso!" });
                fetchUsers();
            } catch (error) {
                const message = error.response?.data?.message || "Erro ao deletar o usuário.";
                setNotification({ show: true, color: "error", message });
            }
        }
    };

    return (
        <AdminPageLayout
            title="Gerenciamento de Usuários"
            buttonText="Adicionar Usuário"
            onButtonClick={handleAddClick}
        >
            <MDBox mt={2} mb={2}>
                <Collapse in={notification.show}>
                    <MDAlert color={notification.color}>
                        <MDTypography variant="body2" color="white">
                            {notification.message}
                        </MDTypography>
                    </MDAlert>
                </Collapse>
            </MDBox>

            <MDBox mb={2} sx={{ width: { xs: "100%", md: "200px" }, ml: "auto" }}>
                <MDInput 
                    label="Pesquisar por nome..."
                    fullWidth
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                />
            </MDBox>
            
            {loading ? (
                <MDTypography variant="body2" textAlign="center">Carregando usuários...</MDTypography>
            ) : (
                <DataTable table={tableData} isSorted={false} entriesPerPage={false} showTotalEntries={false} noEndBorder />
            )}

            {selectedUser && (
                <EditUserModal
                    open={isEditModalOpen}
                    onClose={handleCloseEditModal}
                    user={selectedUser}
                    onSave={handleSaveUser}
                />
            )}
            <AddUserModal
                open={isAddModalOpen}
                onClose={handleCloseAddModal}
                onSave={handleCreateUser}
            />

            {/* --- MODAL DE SUCESSO DO RESET DE SENHA --- */}
            <Dialog
                open={resetDialog.open}
                onClose={handleCloseResetDialog}
                aria-labelledby="alert-dialog-title"
                aria-describedby="alert-dialog-description"
            >
                <DialogTitle id="alert-dialog-title">
                    {"Senha Resetada com Sucesso"}
                </DialogTitle>
                <DialogContent>
                    <DialogContentText id="alert-dialog-description">
                        A senha do usuário <strong>{resetDialog.userName}</strong> foi alterada.
                        <br /><br />
                        Informe a seguinte senha temporária para o usuário:
                    </DialogContentText>
                    
                    <MDBox 
                        bgColor="grey.200" 
                        p={2} 
                        my={2} 
                        borderRadius="lg" 
                        textAlign="center"
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        gap={1}
                    >
                        <MDTypography variant="h4" color="dark" fontWeight="bold" sx={{ letterSpacing: '2px' }}>
                            {resetDialog.tempPassword}
                        </MDTypography>
                    </MDBox>

                    <MDAlert color="warning">
                        <MDTypography variant="caption" color="white" fontWeight="medium">
                             Aviso: O usuário deve alterar esta senha imediatamente após o próximo login.
                        </MDTypography>
                    </MDAlert>
                </DialogContent>
                <DialogActions>
                    <MDButton onClick={handleCloseResetDialog} color="info" variant="gradient" autoFocus>
                        Entendi
                    </MDButton>
                </DialogActions>
            </Dialog>

        </AdminPageLayout>
    );
}

export default GerenciarUsuarios;