import { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Autocomplete from "@mui/material/Autocomplete";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";

function EditResourceAliasModal({ open, onClose, resource, onSave }) {
  const [aliases, setAliases] = useState([]);

  useEffect(() => {
    if (resource) {
      // Se o recurso já tem aliases (array), usa. Se for null, inicia vazio.
      // O backend envia JSON, que o axios converte para Array JS automaticamente.
      const existing = resource.aliases;
      if (Array.isArray(existing)) {
        setAliases(existing);
      } else if (typeof existing === 'string') {
         // Fallback caso venha como string
         try { setAliases(JSON.parse(existing)); } catch(e) { setAliases([]); }
      } else {
        setAliases([]);
      }
    }
  }, [resource]);

  const handleSave = () => {
    // Envia apenas o array de aliases para o pai salvar
    onSave(resource.id, aliases);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Gerenciar Apelidos (Alias)</DialogTitle>
      <DialogContent>
        <MDBox pt={1}>
          <MDTypography variant="body2" color="text" mb={2}>
            Adicione nomes alternativos para o recurso <strong>{resource?.name_resource}</strong>. 
            Isso ajuda a identificar perfis técnicos com nomes de negócio amigáveis.
          </MDTypography>

          <MDBox mb={2}>
             <Autocomplete
                multiple
                freeSolo
                options={[]} // Não tem opções pré-definidas, o usuário cria
                value={aliases}
                onChange={(event, newValue) => {
                  setAliases(newValue);
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip 
                      variant="outlined" 
                      label={option} 
                      {...getTagProps({ index })} 
                      color="info"
                    />
                  ))
                }
                renderInput={(params) => (
                  <TextField 
                    {...params} 
                    variant="outlined" 
                    label="Digite o Alias e pressione Enter" 
                    placeholder="Ex: Gerente Financeiro" 
                  />
                )}
              />
          </MDBox>
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton onClick={onClose} color="secondary">Cancelar</MDButton>
        <MDButton onClick={handleSave} variant="gradient" color="info">Salvar Alterações</MDButton>
      </DialogActions>
    </Dialog>
  );
}

EditResourceAliasModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  resource: PropTypes.object,
  onSave: PropTypes.func.isRequired,
};

export default EditResourceAliasModal;