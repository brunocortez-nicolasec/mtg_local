// material-react-app/src/components/ForcePasswordChange/index.js

import { useState, useEffect } from "react";
import axios from "axios";
import { useMaterialUIController } from "context";
import { useNavigate, useLocation } from "react-router-dom";

// UI Components
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogActions from "@mui/material/DialogActions";
import MDButton from "components/MDButton";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function ForcePasswordChange() {
  const [controller] = useMaterialUIController();
  const { token } = controller;
  
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation(); 

  const API_URL = process.env.REACT_APP_API_URL;
  const api = axios.create({
     baseURL: API_URL,
     headers: { Authorization: `Bearer ${token}` }
  });

  const checkStatus = () => {
      if (!token) return;

      api.get("/me")
         .then(response => {
             // --- CORREÇÃO AQUI: CAMINHO CORRETO DO JSON ---
             const attributes = response.data.data?.attributes || {};
             const mustChange = attributes.mustChangePassword;
             // ------------------------------------------------

             // Se estiver na página de perfil, não bloqueia (para ele poder trocar)
             const isAlreadyOnProfile = location.pathname === "/user-profile"; 
             
             if (mustChange && !isAlreadyOnProfile) {
                 setIsOpen(true);
             } else {
                 setIsOpen(false);
             }
         })
         .catch(err => console.error("Erro ao verificar status da senha", err));
  };

  // Verifica ao carregar e sempre que mudar de rota (impede fuga pela URL)
  useEffect(() => {
      if (token) {
          checkStatus();
      }
  }, [token, location.pathname]);

  const handleRedirect = () => {
      setIsOpen(false); 
      navigate("/user-profile"); 
  };

  return (
    <Dialog 
        open={isOpen} 
        disableEscapeKeyDown 
        // Sem onClose para impedir clique fora
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        PaperProps={{
            sx: { 
                borderRadius: "12px",
                boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                zIndex: 9999 // Força ficar acima de tudo
            }
        }}
    >
      <MDBox p={2} textAlign="center">
          <Icon fontSize="large" color="warning" sx={{ fontSize: "3rem !important", mb: 1 }}>
              lock_clock
          </Icon>
          <DialogTitle id="alert-dialog-title" sx={{ p: 1 }}>
              <MDTypography variant="h5" fontWeight="bold" color="warning">
                  Alteração de Senha Necessária
              </MDTypography>
          </DialogTitle>
      </MDBox>

      <DialogContent>
        <DialogContentText id="alert-dialog-description" sx={{ textAlign: "center" }}>
            Sua senha foi resetada por um administrador ou expirou.
            <br /><br />
            Por motivos de segurança, você precisa definir uma nova senha <strong>agora</strong> para continuar utilizando o sistema.
        </DialogContentText>
      </DialogContent>
      
      <DialogActions sx={{ justifyContent: "center", pb: 3 }}>
        <MDButton onClick={handleRedirect} variant="gradient" color="info" size="large">
            Ir para Meu Perfil e Alterar Senha
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

export default ForcePasswordChange;