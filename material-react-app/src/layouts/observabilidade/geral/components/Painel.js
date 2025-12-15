// material-react-app/src/layouts/observabilidade/geral/components/Painel.js

import React, { useState, useEffect } from "react";
import axios from "axios";
import { useMaterialUIController } from "context";

import { useNavigate } from "react-router-dom";
import PropTypes from "prop-types";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import TextField from "@mui/material/TextField";
import Autocomplete from "@mui/material/Autocomplete";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import PieChart from "examples/Charts/PieChart";

// --- Sub-componentes ---

function PillKpi({ label, count, color }) {
  return (
    <MDBox textAlign="center" lineHeight={1}>
      <MDTypography variant="button" fontWeight="medium" color={color} sx={{ textTransform: "capitalize" }}>
        {label}
      </MDTypography>
      <MDTypography variant="h4" fontWeight="bold" mt={1}>
        {count}
      </MDTypography>
    </MDBox>
  );
}

function MiniMetricCard({ title, count, color = "dark" }) {
  return (
    <MDBox p={1} textAlign="center">
      <MDTypography variant="button" color="text" fontWeight="regular" sx={{ whiteSpace: "normal" }}>
        {title}
      </MDTypography>
      <MDTypography variant="h2" fontWeight="bold" color={color} mt={1}>
        {count}
      </MDTypography>
    </MDBox>
  );
}

function Painel({ imDisplay, onPieChartClick, divergenceChart, onDivergenceChartClick, onPlatformChange, selectedPlatform }) {
  const navigate = useNavigate();

  const [controller] = useMaterialUIController();
  const { token } = controller;
  const [systemOptions, setSystemOptions] = useState(["Geral"]); 

  const API_URL = process.env.REACT_APP_API_URL;

  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  useEffect(() => {
    const fetchSystems = async () => {
      if (!token) return;
      try {
        const response = await api.get('/systems');
        const data = response.data;
        
        const safeData = Array.isArray(data) ? data : [];
        
        const systemNames = new Set(
          safeData
            .filter(ds => ds.origem_datasource === 'SISTEMA' && ds.systemConfig?.system?.name_system)
            .map(ds => ds.systemConfig.system.name_system)
        );
        
        setSystemOptions(["Geral", ...systemNames]);

      } catch (error) {
        console.error("Erro ao buscar a lista de sistemas:", error);
        setSystemOptions(["Geral"]);
      }
    };

    fetchSystems();
  }, [token]);


  const titleText = selectedPlatform === "Geral" ? "Painel Geral" : `Painel de ${selectedPlatform}`;
  
  const appLabel = selectedPlatform === "Geral" ? "App" : selectedPlatform;

  const handleSystemSelect = (event, newValue) => {
    if (newValue) {
      onPlatformChange(newValue);
    }
  };
  
  const handleRedirectToImportPage = () => {
    navigate("/observabilidade/import-management");
  };
  
  return (
    <Card sx={{ height: "100%" }}>
      <MDBox pt={2} px={2} display="flex" alignItems="center" justifyContent="space-between">
        <MDBox sx={{ flex: 1, display: 'flex' }} />
        <MDBox sx={{ flex: '0 1 auto', textAlign: 'center' }}>
          <MDTypography variant="h6">{titleText}</MDTypography>
        </MDBox>
        <MDBox sx={{ flex: 1, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
          <Autocomplete
            disableClearable
            options={systemOptions}
            value={selectedPlatform}
            onChange={handleSystemSelect}
            size="small"
            sx={{ width: 180 }}
            getOptionLabel={(option) => option || ""} 
            isOptionEqualToValue={(option, value) => option === value}
            renderInput={(params) => <TextField {...params} label="Sistemas" />}
          />
          <MDButton variant="outlined" color="info" size="small" onClick={handleRedirectToImportPage}>
            <Icon sx={{ mr: 0.5 }}>upload</Icon>
            Importar Dados
          </MDButton>
        </MDBox>
      </MDBox>
      
      <MDBox p={2}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Card>
              <MDBox p={2}>
                <Grid container spacing={2} justifyContent="space-around">
                  <Grid item xs={6} sm={3}><PillKpi label="Usuários" count={imDisplay.pills.total} color="info"/></Grid>
                  <Grid item xs={6} sm={3}><PillKpi label="Ativos" count={imDisplay.pills.ativos} color="success" /></Grid>
                  <Grid item xs={6} sm={3}><PillKpi label="Inativos" count={imDisplay.pills.inativos} color="error" /></Grid>
                  <Grid item xs={6} sm={3}><PillKpi label="Desconhecido" count={imDisplay.pills.desconhecido} color="secondary" /></Grid>
                </Grid>
              </MDBox>
            </Card>
          </Grid>

          {/* COLUNA 1: Gráfico de Divergências */}
          <Grid item xs={12} md={4}>
             <Card sx={{ height: "100%" }}>
                {/* ALTERAÇÃO AQUI: pt={2} e pb={1} para controle fino */}
                <MDBox pt={2} pb={1} px={2} display="flex" justifyContent="center">
                    {/* ALTERAÇÃO AQUI: m: 0 e lineHeight: 1 removem a margem indesejada */}
                    <MDTypography 
                        variant="h6" 
                        fontWeight="medium" 
                        textTransform="capitalize" 
                        sx={{ fontSize: "1rem", m: 0, lineHeight: 0 }}
                    >
                        Tipos de Divergência
                    </MDTypography>
                </MDBox>
                
                {/* Mantendo altura para o gráfico não cortar */}
                <MDBox p={1} pt={0} sx={{ height: "100%", minHeight: "165px" }}>
                   <PieChart chart={divergenceChart} onClick={onDivergenceChartClick} />
                </MDBox>
             </Card>
          </Grid>

          {/* COLUNA 2: Gráfico de Tipos de Usuários */}
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%" }}>
              {/* ALTERAÇÃO AQUI: pt={2} e pb={1} para controle fino */}
              <MDBox pt={2} pb={1} px={2} display="flex" justifyContent="center">
                 {/* ALTERAÇÃO AQUI: m: 0 e lineHeight: 1 removem a margem indesejada */}
                 <MDTypography 
                    variant="h6" 
                    fontWeight="medium" 
                    textTransform="capitalize" 
                    sx={{ fontSize: "1rem", m: 0, lineHeight: 0 }}
                 >
                    Tipos de Usuários
                 </MDTypography>
              </MDBox>
              
              {/* Mantendo altura para o gráfico não cortar */}
              <MDBox p={1} pt={0} sx={{ height: "100%", minHeight: "165px" }}>
                <PieChart chart={imDisplay.tiposChart} onClick={onPieChartClick} />
              </MDBox>
            </Card>
          </Grid>
          
          {/* COLUNA 3: Cards de Métricas */}
          <Grid item xs={12} md={4}>
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <Card sx={{ height: "100%", p: 1 }}>
                  <Grid container spacing={1} sx={{height: '100%'}}>
                    <Grid item xs={6}><MiniMetricCard title={`Ativos não encontrados no ${appLabel}`} count={imDisplay.divergencias.acessoPrevistoNaoConcedido} color="error"/></Grid>
                    <Grid item xs={6}><MiniMetricCard title="Ativos não encontrados no RH" count={imDisplay.divergencias.ativosNaoEncontradosRH} color="warning"/></Grid>
                  </Grid>
                </Card>
              </Grid>
              <Grid item xs={12}> 
                <Card sx={{ height: "100%", p: 1 }}>
                  <Grid container spacing={1} sx={{height: '100%'}}>
                    <Grid item xs={6}><MiniMetricCard title="Contas Dormentes" count={imDisplay.kpisAdicionais.contasDormentes} color="warning"/></Grid>
                    <Grid item xs={6}><MiniMetricCard title="Acesso Privilegiado" count={imDisplay.kpisAdicionais.acessoPrivilegiado} color="info"/></Grid>
                  </Grid>
                </Card>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </MDBox>
    </Card>
  );
}

Painel.propTypes = {
  imDisplay: PropTypes.object.isRequired,
  onPieChartClick: PropTypes.func.isRequired,
  divergenceChart: PropTypes.object,
  onDivergenceChartClick: PropTypes.func,
  onPlatformChange: PropTypes.func.isRequired,
  selectedPlatform: PropTypes.string.isRequired,
};

Painel.defaultProps = {
  divergenceChart: { labels: [], datasets: {} },
  onDivergenceChartClick: () => {},
};

export default Painel;