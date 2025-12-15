import { useState, useEffect, useRef } from "react";
import Collapse from "@mui/material/Collapse";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Chip from "@mui/material/Chip"; 

import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDAlert from "components/MDAlert";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Header from "layouts/user-profile/Header";
import AuthService from "../../services/auth-service";
import axios from "axios";
import { useMaterialUIController, setAuth } from "context";

// Componente auxiliar para exibir itens do perfil
const ProfileInfoItem = ({ label, value, children }) => (
  <MDBox display="flex" flexDirection="column" mb={2}>
    <MDTypography variant="caption" fontWeight="bold" color="text" textTransform="uppercase">
      {label}
    </MDTypography>
    {children ? children : (
        <MDTypography variant="button" fontWeight="medium" color="dark">
           {value || "-"}
        </MDTypography>
    )}
  </MDBox>
);

const UserProfile = () => {
  const [controller, dispatch] = useMaterialUIController();
  const { user: authUser, token } = controller;
  
  const fileInputRef = useRef(null);
  const [notification, setNotification] = useState({ show: false, message: "", color: "info" });
  
  const [formState, setFormState] = useState({
    newPassword: "", 
    confirmPassword: "",
    profile_image: null
  });

  const [userData, setUserData] = useState({
    name: "", email: "", role: "", package: "", groups: [], createdAt: ""
  });

  const API_URL = process.env.REACT_APP_API_URL;

  // --- CORREÇÃO PRINCIPAL: Leitura Inteligente dos Dados ---
  // O App.js agora entrega os dados "limpos" na raiz do objeto authUser.
  // Esta lógica garante que leremos corretamente independente do formato.
  useEffect(() => {
    if (authUser) {
      // Tenta pegar de 'data.attributes' (formato antigo/bruto) OU direto da raiz (formato novo/limpo)
      const attributes = authUser.data?.attributes || authUser;
      
      setUserData({
        name: attributes.name || "",
        email: attributes.email || "",
        // O role pode vir como string direta ou dentro de um objeto profile
        role: attributes.role || (attributes.profile ? attributes.profile.name : ""),
        package: attributes.package || "",
        groups: attributes.groups || [],
        createdAt: attributes.createdAt ? new Date(attributes.createdAt).toLocaleDateString('pt-BR') : ""
      });

      // Atualiza a imagem no estado do formulário
      setFormState(prev => ({ ...prev, profile_image: attributes.profile_image }));
    }
  }, [authUser]);
  // ---------------------------------------------------------

  useEffect(() => {
    if (notification.show) {
      const timer = setTimeout(() => setNotification(prev => ({ ...prev, show: false })), 5000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const changeHandler = (e) => setFormState({ ...formState, [e.target.name]: e.target.value });

  // --- LÓGICA DE VALIDAÇÃO ---
  const getOriginalImage = () => {
      if (!authUser) return null;
      // Mesma lógica de leitura inteligente para a imagem original
      return authUser.data?.attributes?.profile_image || authUser.profile_image;
  };
  
  const originalImage = getOriginalImage();
  const hasImageChanged = formState.profile_image !== originalImage;

  const passwordChanged = formState.newPassword.length > 0;
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>])(?=.{8,})/;
  const isComplex = passwordRegex.test(formState.newPassword);
  const doPasswordsMatch = formState.newPassword === formState.confirmPassword;
  
  const complexityError = passwordChanged && !isComplex;
  const matchError = passwordChanged && !doPasswordsMatch;

  const isPasswordValid = !passwordChanged || (isComplex && doPasswordsMatch);
  const canSave = (hasImageChanged || passwordChanged) && isPasswordValid;
  // ---------------------------

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setFormState(prev => ({ ...prev, profile_image: reader.result }));
      reader.readAsDataURL(file);
    }
  };

  const submitHandler = async (e) => {
    e.preventDefault();
    if (!canSave) return; 

    const attributes = {};

    if (hasImageChanged) {
        attributes.profile_image = formState.profile_image;
    }

    if (passwordChanged) {
        attributes.newPassword = formState.newPassword;
        attributes.confirmPassword = formState.confirmPassword;
    }

    try {
      await AuthService.updateProfile({ data: { attributes } }); 
      
      // Busca os dados atualizados
      const updatedUserResponse = await axios.get(`${API_URL}/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // --- CORREÇÃO NO UPDATE: Normaliza os dados antes de salvar no contexto ---
      const backendData = updatedUserResponse.data.data;
      const userAttributes = backendData?.attributes || updatedUserResponse.data;
      
      const userFormatted = {
          id: backendData?.id || updatedUserResponse.data.id,
          ...userAttributes
      };

      setAuth(dispatch, { token, user: userFormatted });
      setNotification({ show: true, message: "Alterações salvas com sucesso!", color: "success" });
      
      // Limpa os campos de senha
      setFormState(prev => ({ ...prev, newPassword: "", confirmPassword: "" }));

    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      setNotification({ show: true, message: error.response?.data?.message || "Erro ao atualizar.", color: "error" });
    }
  };

  const handleAvatarClick = () => fileInputRef.current.click();

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox mb={2} />
      <Header
        name={userData.name || "Usuário"} 
        role={userData.role || "Sem perfil"}
        profileImage={formState.profile_image} 
        onAvatarClick={handleAvatarClick}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/png, image/jpeg"
          style={{ display: "none" }}
        />

        <MDBox mt={5} mb={3}>
            <Grid container spacing={1}>
                {/* Coluna da Esquerda: Dados Cadastrais */}
                <Grid item xs={12} md={6} xl={4}>
                      <Card sx={{ height: "100%", boxShadow: "none", border: "1px solid #e0e0e0" }}>
                        <MDBox p={2}>
                            <MDTypography variant="h6" fontWeight="medium" textTransform="capitalize">
                                Informações da Conta
                            </MDTypography>
                        </MDBox>
                        <MDBox pt={0} pb={2} px={2}>
                            <ProfileInfoItem label="Nome Completo" value={userData.name} />
                            <ProfileInfoItem label="Email" value={userData.email} />
                            <Grid container spacing={2}>
                                <Grid item xs={6}>
                                    <ProfileInfoItem label="Função / Perfil" value={userData.role} />
                                </Grid>
                                <Grid item xs={6}>
                                    <ProfileInfoItem label="Data de Criação" value={userData.createdAt} />
                                </Grid>
                            </Grid>
                        </MDBox>
                    </Card>
                </Grid>

                {/* Coluna do Meio: Acessos e Grupos */}
                <Grid item xs={12} md={6} xl={4}>
                      <Card sx={{ height: "100%", boxShadow: "none", border: "1px solid #e0e0e0" }}>
                        <MDBox p={2}>
                            <MDTypography variant="h6" fontWeight="medium" textTransform="capitalize">
                                Acessos e Permissões
                            </MDTypography>
                        </MDBox>
                        <MDBox pt={0} pb={2} px={2}>
                             <ProfileInfoItem label="Pacote Atribuído" value={userData.package} />
                             
                             <ProfileInfoItem label="Grupos">
                                 {userData.groups && userData.groups.length > 0 ? (
                                     <MDBox display="flex" flexWrap="wrap" gap={1}>
                                         {userData.groups.map((group, idx) => (
                                             <Chip 
                                                key={idx} 
                                                label={group} 
                                                size="small" 
                                                color="info" 
                                                variant="outlined"
                                             />
                                         ))}
                                     </MDBox>
                                 ) : (
                                     <MDTypography variant="caption" color="text" fontStyle="italic">Nenhum grupo atribuído</MDTypography>
                                 )}
                             </ProfileInfoItem>
                        </MDBox>
                    </Card>
                </Grid>

                {/* Coluna da Direita: Alterar Senha e Salvar */}
                <Grid item xs={12} xl={4}>
                      <Card sx={{ height: "100%", boxShadow: "none", border: "1px solid #e0e0e0" }}>
                        <MDBox p={2}>
                            <MDTypography variant="h6" fontWeight="medium" textTransform="capitalize">
                                Segurança & Perfil
                            </MDTypography>
                        </MDBox>
                        <MDBox pt={0} pb={2} px={2} component="form" role="form" onSubmit={submitHandler}>
                             <MDTypography variant="caption" color="text" mb={2} display="block">
                                 Para alterar sua senha, preencha os campos abaixo. A nova senha deve conter letras maiúsculas, minúsculas, números e caracteres especiais.
                             </MDTypography>

                             <MDBox mb={2}>
                                <MDInput 
                                    type="password" 
                                    label="Nova Senha" 
                                    name="newPassword" 
                                    fullWidth
                                    value={formState.newPassword} 
                                    onChange={changeHandler} 
                                    error={complexityError}
                                />
                             </MDBox>
                             
                             <MDBox mb={2}>
                                <MDInput 
                                    type="password" 
                                    label="Confirmar Senha" 
                                    name="confirmPassword" 
                                    fullWidth
                                    value={formState.confirmPassword} 
                                    onChange={changeHandler} 
                                    error={matchError}
                                    disabled={!formState.newPassword}
                                />
                             </MDBox>

                             <Collapse in={notification.show}>
                                <MDAlert color={notification.color} mb={2}>
                                    <MDTypography variant="caption" color="white">{notification.message}</MDTypography>
                                </MDAlert>
                            </Collapse>

                             <MDBox mt={2} display="flex" justifyContent="flex-end">
                                <MDButton 
                                    variant="gradient" 
                                    color="info" 
                                    type="submit"
                                    disabled={!canSave}
                                >
                                    Salvar Alterações
                                </MDButton>
                             </MDBox>
                        </MDBox>
                    </Card>
                </Grid>
            </Grid>
        </MDBox>

      </Header>
    </DashboardLayout>
  );
};

export default UserProfile;