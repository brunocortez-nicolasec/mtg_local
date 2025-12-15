//material-react-app/src/components/SafeDialog/index.js
import React, { useState } from "react";
import PropTypes from "prop-types";

// Material Dashboard 2 React components
import MDButton from "components/MDButton";

// @mui components
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogContentText from "@mui/material/DialogContentText";
import DialogTitle from "@mui/material/DialogTitle";

function SafeDialog({ open, onClose, children, isDirty, titleConfirm, textConfirm, ...props }) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleCloseAttempt = (event, reason) => {

    if (!isDirty) {
      onClose(event, reason);
      return;
    }

    // Se estiver sujo e a tentativa for clicar fora ou ESC, pede confirmação
    if (reason === 'backdropClick' || reason === 'escapeKeyDown') {
      setConfirmOpen(true);
    } else {
      if (!reason) {
         // Fechamento programático (botão cancelar)
         setConfirmOpen(true);
      } else {
         onClose(event, reason);
      }
    }
  };

  const handleConfirmClose = () => {
    setConfirmOpen(false);
    // Chama o onClose original forçando o fechamento
    onClose({}, 'forceClose'); 
  };

  return (
    <>
      {/* Modal Principal (Repassa todas as props do MUI Dialog) */}
      <Dialog open={open} onClose={handleCloseAttempt} {...props}>
        {children}
      </Dialog>

      {/* Modal de Confirmação de Descarte */}
      <Dialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        style={{ zIndex: 1500 }} // Garante que fique acima do modal principal
        PaperProps={{ style: { zIndex: 1500 } }}
      >
        <DialogTitle>{titleConfirm || "Descartar alterações?"}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {textConfirm || "Você inseriu dados que não foram salvos. Se fechar agora, eles serão perdidos."}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setConfirmOpen(false)} color="info">
            Continuar Editando
          </MDButton>
          <MDButton onClick={handleConfirmClose} color="error" variant="gradient">
            Descartar e Sair
          </MDButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

SafeDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  children: PropTypes.node,
  isDirty: PropTypes.bool,
  titleConfirm: PropTypes.string,
  textConfirm: PropTypes.string,
};

SafeDialog.defaultProps = {
  isDirty: false,
};

export default SafeDialog;