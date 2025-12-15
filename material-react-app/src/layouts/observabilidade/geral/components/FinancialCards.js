// material-react-app/src/layouts/observabilidade/geral/components/FinancialCards.js

import React from "react";
import PropTypes from "prop-types";

import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function FinancialCards({ prejuizoPotencial, valorMitigado, plataformaSelecionada, onClick }) {
  // Deixa o título do card de mitigação dinâmico
  const valorMitigadoTitle = plataformaSelecionada === 'Geral' 
    ? 'Valor Mitigado (Geral)' 
    : `Valor Mitigado de ${plataformaSelecionada}`;

  return (
    <Grid item xs={12} lg={3}>
      <Grid container spacing={3} direction="column">
        <Grid item>
          <Card>
            <MDBox p={2} textAlign="center">
              <MDBox display="grid" justifyContent="center" alignItems="center" bgColor="error" color="white" width="4rem" height="4rem" shadow="md" borderRadius="lg" variant="gradient" sx={{ mt: -3, mb: 2, mx: 'auto' }}>
                <Icon fontSize="large">money_off</Icon>
              </MDBox>
              <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>Prejuízo Potencial (Mensal)</MDTypography>
              <MDTypography variant="body2" color="text" sx={{mb: 3}}>Custo total com riscos e divergências identificadas.</MDTypography>
              <Card>
                <MDBox 
                  p={1} 
                  onClick={() => onClick && onClick('prejuizo')} 
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                >
                  <MDTypography variant="h2" fontWeight="bold" color="error"> {prejuizoPotencial} </MDTypography>
                </MDBox>
              </Card>
            </MDBox>
          </Card>
        </Grid>
        <Grid item>
          <Card>
            <MDBox p={2} textAlign="center">
              <MDBox display="grid" justifyContent="center" alignItems="center" bgColor="success" color="white" width="4rem" height="4rem" shadow="md" borderRadius="lg" variant="gradient" sx={{ mt: -3, mb: 2, mx: 'auto' }}>
                <Icon fontSize="large">savings</Icon>
              </MDBox>
              <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>{valorMitigadoTitle}</MDTypography>
              <MDTypography variant="body2" color="text" sx={{mb: 3}}> Redução de 95% do prejuízo potencial com governança. </MDTypography>
              <Card>
                <MDBox 
                  p={1}
                  onClick={() => onClick && onClick('mitigado')} 
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'action.hover' } }}
                >
                  <MDTypography variant="h2" fontWeight="bold" color="success"> {valorMitigado} </MDTypography>
                </MDBox>
              </Card>
            </MDBox>
          </Card>
        </Grid>
      </Grid>
    </Grid>
  );
}

FinancialCards.propTypes = {
  prejuizoPotencial: PropTypes.string, // Removido isRequired para evitar warnings iniciais
  valorMitigado: PropTypes.string,
  plataformaSelecionada: PropTypes.string,
  onClick: PropTypes.func,
};

FinancialCards.defaultProps = {
  prejuizoPotencial: "R$ 0,00",
  valorMitigado: "R$ 0,00",
  plataformaSelecionada: "Geral",
  onClick: () => {},
};

export default FinancialCards;