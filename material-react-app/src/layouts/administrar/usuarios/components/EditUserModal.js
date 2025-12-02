// material-react-app/src/layouts/administrar/usuarios/components/EditUserModal.js

import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import axios from "axios";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

function EditUserModal({ open, onClose, user, onSave }) {
  const [userData, setUserData] = useState({ 
    name: "", 
    email: "", 
    role: "", 
    packageId: "", 
    password: "", 
    confirmPassword: "" 
  });
  
  const [profiles, setProfiles] = useState([]);
  const [packages, setPackages] = useState([]);

  const API_URL = process.env.REACT_APP_API_URL;

  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
  });

  // --- LÓGICA DE VALIDAÇÃO DE SENHA (COMPLEXIDADE) ---
  const passwordChanged = userData.password.length > 0;
  
  // Regex para validações
  const hasUpperCase = /[A-Z]/.test(userData.password);
  const hasLowerCase = /[a-z]/.test(userData.password);
  const hasNumber = /\d/.test(userData.password);
  const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(userData.password);
  const hasMinLength = userData.password.length >= 8;

  // Valida se cumpre todos os requisitos
  const isPasswordComplex = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;
  
  // Erro de complexidade só aparece se o utilizador já começou a digitar
  const complexityError = passwordChanged && !isPasswordComplex;

  // Valida igualdade (Confirmação)
  const passwordsMatch = userData.password === userData.confirmPassword;
  const matchError = passwordChanged && !passwordsMatch;

  // Bloqueia botão se houver qualquer erro
  const isSaveDisabled = passwordChanged && (complexityError || matchError);

  useEffect(() => {
    const fetchProfiles = async () => {
      try {
        const response = await api.get("/profiles"); 
        const data = response.data;
        setProfiles(Array.isArray(data) ? data : []); 
      } catch (error) {
        console.error("Erro ao buscar perfis:", error); 
        setProfiles([]);
      }
    };

    const fetchPackages = async () => {
      try {
        const response = await api.get("/packages");
        const data = response.data;
        setPackages(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Erro ao buscar pacotes:", error);
        setPackages([]);
      }
    };

    if (open) {
      fetchProfiles();
      fetchPackages();
    }
  }, [open]);

  useEffect(() => {
    if (user) {
      setUserData({
        name: user.name || "",
        email: user.email || "",
        role: user.profile?.name || "", 
        packageId: user.packageId || "",
        password: "",       
        confirmPassword: "" 
      });
    }
  }, [user]);

  const handleChange = (e) => {
    setUserData({ ...userData, [e.target.name]: e.target.value });
  };

  const handleSave = () => {
    // Segurança final antes de enviar
    if (isSaveDisabled) return;

    const payload = { ...userData };
    delete payload.confirmPassword;

    if (!payload.password) {
        delete payload.password;
    }

    onSave(user.id, payload);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Editar Usuário</DialogTitle>
      <DialogContent>
        <MDBox component="form" role="form" pt={2}>
          <MDBox mb={2}>
            <MDInput
              type="text"
              label="Nome"
              name="name"
              value={userData.name}
              onChange={handleChange}
              fullWidth
            />
          </MDBox>
          <MDBox mb={2}>
            <MDInput
              type="email"
              label="Email"
              name="email"
              value={userData.email}
              onChange={handleChange}
              fullWidth
            />
          </MDBox>
          
          {/* --- BLOCO DE SENHA COM VALIDAÇÃO DE COMPLEXIDADE --- */}
          <MDBox mb={2}>
            <MDInput
              type="password"
              label="Nova Senha"
              name="password"
              value={userData.password}
              onChange={handleChange}
              fullWidth
              placeholder="Deixe em branco para não alterar"
              error={complexityError} 
              helperText={complexityError 
                ? "A senha deve ter mín. 8 caracteres, maiúscula, minúscula, número e caractere especial." 
                : "Requisitos: 8 caracteres, maiúscula, minúscula, número e especial."
              }
            />
          </MDBox>
          
          {passwordChanged && (
             <MDBox mb={2}>
                <MDInput
                  type="password"
                  label="Confirmar Nova Senha"
                  name="confirmPassword"
                  value={userData.confirmPassword}
                  onChange={handleChange}
                  fullWidth
                  placeholder="Repita a nova senha"
                  error={matchError} 
                  helperText={matchError ? "As senhas não coincidem." : ""}
                />
             </MDBox>
          )}

          <MDBox mb={2}>
            <FormControl fullWidth>
              <InputLabel id="role-select-label">Função (Perfil)</InputLabel>
              <Select
                labelId="role-select-label"
                name="role" 
                value={userData.role} 
                label="Função (Perfil)"
                onChange={handleChange}
                sx={{ height: "44px" }}
              >
                {profiles.map((profile) => (
                  <MenuItem key={profile.id} value={profile.name}>
                    {profile.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </MDBox>

          <MDBox mb={2}>
            <FormControl fullWidth>
              <InputLabel id="package-select-label">Pacote</InputLabel>
              <Select
                labelId="package-select-label"
                name="packageId"
                value={userData.packageId}
                label="Pacote"
                onChange={handleChange}
                sx={{ height: "44px" }}
              >
                <MenuItem value="">
                  <em>Nenhum</em>
                </MenuItem>
                {packages.map((pkg) => (
                  <MenuItem key={pkg.id} value={pkg.id}>
                    {pkg.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </MDBox>
          
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton onClick={onClose} color="secondary">
          Cancelar
        </MDButton>
        <MDButton 
            onClick={handleSave} 
            variant="contained" 
            color="info"
            disabled={isSaveDisabled} // Bloqueia se a senha for fraca ou não coincidir
        >
          Salvar
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

EditUserModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  user: PropTypes.object,
  onSave: PropTypes.func.isRequired,
};

export default EditUserModal;