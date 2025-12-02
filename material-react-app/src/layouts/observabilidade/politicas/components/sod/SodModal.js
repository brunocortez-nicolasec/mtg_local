// material-react-app/src/layouts/observabilidade/politicas/components/sod/SodModal.js

import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import PropTypes from 'prop-types';

// @mui material components
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";
import FormHelperText from "@mui/material/FormHelperText"; 
import MDInput from "components/MDInput"; 
import { useMaterialUIController } from "context"; 

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";

// Componentes Filhos e Configs ATUALIZADOS
import DynamicRuleFields from "./DynamicRuleFields";
import { initialState, ruleTypes, comparisonOperators } from "./sodConfig";

// Objeto especial para "Todos"
const ALL_SYSTEMS_OPTION = { id: null, name: "Global (Todos os Sistemas)" };

// Estado Inicial agora usa null como padrão para system
const newInitialState = {
  ...initialState,
  system: null,
};


function SodModal({ open, onClose, onRefresh, showSnackbar, token, ruleToEdit,
  resources: allResources, 
  systems: allSystems,
  attributes: allAttributes
}) {
  
  const [controller] = useMaterialUIController(); 
  const { darkMode } = controller; 
  
  const [currentRule, setCurrentRule] = useState(newInitialState);
  const [isEditing, setIsEditing] = useState(false);
  const [filteredResources, setFilteredResources] = useState([]); 

  const systemOptions = useMemo(() => [ALL_SYSTEMS_OPTION, ...allSystems], [allSystems]);

  // --- CORREÇÃO: URL CORRETA ---
  const API_URL = process.env.REACT_APP_API_URL;

  const api = axios.create({
    baseURL: API_URL,
    headers: { Authorization: `Bearer ${token}` },
  });

  const availableRuleTypes = useMemo(() => {
    if (currentRule.system?.id === null) {
      return ruleTypes.filter(type => !type.id.includes('ROLE'));
    }
    return ruleTypes;
  }, [currentRule.system]);


  useEffect(() => {
    if (open) {
      if (ruleToEdit) {
        setIsEditing(true);

        const system = ruleToEdit.systemId === null
          ? ALL_SYSTEMS_OPTION
          : allSystems.find(s => s.id === ruleToEdit.systemId) || null;

        const resourcesForThisSystem = (system && system.id !== null)
            ? allResources.filter(r => r.systemId === system.id) 
            : [];
        setFilteredResources(resourcesForThisSystem); 
        
        const currentAvailableRuleTypes = (system && system.id === null)
            ? ruleTypes.filter(type => !type.id.includes('ROLE'))
            : ruleTypes;

        let type = currentAvailableRuleTypes.find(t => t.id === ruleToEdit.ruleType);
        if (!type) {
            type = currentAvailableRuleTypes[0] || ruleTypes[0];
        }

        let loadedValueA = null;
        let loadedOperatorA = comparisonOperators[0];
        let loadedValueValueA = "";
        let loadedValueB = null;

        if (ruleToEdit.valueAType === 'PROFILE' && resourcesForThisSystem.length > 0) {
          loadedValueA = resourcesForThisSystem.find(p => p.id === parseInt(ruleToEdit.valueAId, 10)); 
        } else if (ruleToEdit.valueAType === 'ATTRIBUTE') {
          loadedValueA = allAttributes.find(a => a.id === ruleToEdit.valueAId);
          loadedOperatorA = comparisonOperators.find(op => op.id === ruleToEdit.valueAOperator) || comparisonOperators[0];
          loadedValueValueA = ruleToEdit.valueAValue || "";
        }

        if (ruleToEdit.valueBType === 'PROFILE' && resourcesForThisSystem.length > 0) {
          loadedValueB = resourcesForThisSystem.find(p => p.id === parseInt(ruleToEdit.valueBId, 10)); 
        } else if (ruleToEdit.valueBType === 'SYSTEM') {
          loadedValueB = allSystems.find(s => s.id === parseInt(ruleToEdit.valueBId, 10));
        }

        setCurrentRule({
          id: ruleToEdit.id,
          name: ruleToEdit.name,
          description: ruleToEdit.description || "",
          areaNegocio: ruleToEdit.areaNegocio || "",
          processoNegocio: ruleToEdit.processoNegocio || "",
          owner: ruleToEdit.owner || "",
          system: system,
          ruleType: type,
          valueASelection: loadedValueA || null,
          valueAOperator: loadedOperatorA,
          valueAValue: loadedValueValueA,
          valueBSelection: loadedValueB || null,
        });
      } else {
        setIsEditing(false);
        setCurrentRule(newInitialState);
        setFilteredResources([]); 
      }
    }
  }, [open, ruleToEdit, allResources, allSystems, allAttributes]); 


  const handleClose = () => {
    setCurrentRule(newInitialState);
    setFilteredResources([]); 
    onClose();
  };


  const handleFormChange = (fieldName, newValue) => {
    setCurrentRule((prev) => {
      const newState = { ...prev, [fieldName]: newValue };

      if (fieldName === 'system') {
        const isGlobal = newValue?.id === null; 
        
        const resourcesForThisSystem = (newValue && !isGlobal)
          ? allResources.filter(p => p.systemId === newValue.id) 
          : [];
        setFilteredResources(resourcesForThisSystem); 
        
        const newAvailableRuleTypes = isGlobal
          ? ruleTypes.filter(type => !type.id.includes('ROLE'))
          : ruleTypes; 
        
        newState.ruleType = newAvailableRuleTypes[0] || null;

        newState.valueASelection = null;
        newState.valueAOperator = comparisonOperators[0];
        newState.valueAValue = "";
        newState.valueBSelection = null;
      }

      if (fieldName === 'ruleType') {
        newState.valueASelection = null;
        newState.valueAOperator = comparisonOperators[0];
        newState.valueAValue = "";
        newState.valueBSelection = null;
      }
      
      if (fieldName === 'valueASelection' && newState.ruleType?.id === 'ROLE_X_ROLE') {
         newState.valueAOperator = comparisonOperators[0];
         newState.valueAValue = "";
      }
      
      return newState;
    });
  };

  const handleSubmit = async () => {
    const { id, name, description, areaNegocio, processoNegocio, owner,
            system,
            ruleType, valueASelection, valueAOperator, valueAValue, valueBSelection
          } = currentRule;

    if (!name || system === null || !ruleType || !valueASelection || !valueBSelection) {
      showSnackbar("warning", "Campos Obrigatórios", "Nome, Sistema, Tipo e os dois campos de comparação são obrigatórios.");
      return;
    }

    if (system.id === null && (ruleType.id.includes('ROLE'))) {
        showSnackbar("error", "Tipo de Regra Inválido", "Regras globais (Todos os Sistemas) não podem usar Perfil como critério. Use Atributos.");
        return;
    }

    let valueAType = '';
    if (ruleType.id.includes('ROLE')) valueAType = 'PROFILE';
    if (ruleType.id.startsWith('ATTR')) valueAType = 'ATTRIBUTE';

    if (valueAType === 'ATTRIBUTE' && (!valueAOperator || !valueAValue.trim())) {
        showSnackbar("warning", "Campos Obrigatórios", "Para regras com Atributo A, o Operador e o Valor do Atributo são obrigatórios.");
        return;
    }

    const payload = {
      name, description, areaNegocio, processoNegocio, owner,
      systemId: system.id, 
      ruleTypeId: ruleType.id,
      valueA: valueASelection,
      valueB: valueBSelection,
      valueAOperator: undefined,
      valueAValue: undefined,
    };

    if (valueAType === 'ATTRIBUTE') {
        payload.valueAOperator = valueAOperator?.id;
        payload.valueAValue = valueAValue;
    }

    try {
      // --- CORREÇÃO: Usando a instância 'api' configurada ---
      if (isEditing) {
        await api.patch(`/sod-rules/${id}`, payload);
      } else {
        await api.post("/sod-rules", payload);
      }
      showSnackbar("success", "Sucesso", `Regra SOD ${isEditing ? 'atualizada' : 'criada'}.`);
      handleClose();
      onRefresh();

    } catch (error) {
      console.error("Erro ao salvar regra SOD:", error);
      const backendMessage = error.response?.data?.message;
      let displayMessage = "Ocorreu um erro inesperado.";
      if (backendMessage) {
        displayMessage = typeof backendMessage === 'string' ? backendMessage : JSON.stringify(backendMessage);
      } else if (error.message) {
        displayMessage = error.message;
      }
      showSnackbar("error", "Erro ao Salvar", displayMessage);
    }
  };


  const availableSystemsForValueB = useMemo(() => {
     if (!currentRule.system || currentRule.system.id === null) {
         return allSystems; 
     }
     return allSystems.filter(s => s.id !== currentRule.system.id); 
  }, [currentRule.system, allSystems]);

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="md">
      <DialogTitle>{isEditing ? "Editar Regra de SOD" : "Criar Nova Regra de SOD"}</DialogTitle>
      <DialogContent>
        <MDBox component="form" role="form" p={2}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <MDInput label="Nome da Regra *" name="name" value={currentRule.name} onChange={(e) => handleFormChange(e.target.name, e.target.value)} fullWidth required variant="outlined" />
            </Grid>
            <Grid item xs={12} md={4}>
              <MDInput label="Área de negócio" name="areaNegocio" value={currentRule.areaNegocio} onChange={(e) => handleFormChange(e.target.name, e.target.value)} fullWidth variant="outlined" />
            </Grid>
            <Grid item xs={12} md={4}>
              <MDInput label="Processo de negócio" name="processoNegocio" value={currentRule.processoNegocio} onChange={(e) => handleFormChange(e.target.name, e.target.value)} fullWidth variant="outlined" />
            </Grid>
            <Grid item xs={12} md={4}>
              <MDInput label="Owner" name="owner" value={currentRule.owner} onChange={(e) => handleFormChange(e.target.name, e.target.value)} fullWidth variant="outlined" />
            </Grid>
            <Grid item xs={12}>
              <MDInput label="Descrição" name="description" value={currentRule.description} onChange={(e) => handleFormChange(e.target.name, e.target.value)} fullWidth multiline rows={2} variant="outlined" />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                options={systemOptions}
                getOptionLabel={(option) => option.name || ""}
                value={currentRule.system}
                onChange={(event, newValue) => handleFormChange("system", newValue)}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                disabled={isEditing}
                renderInput={(params) => <MDInput {...params} label="Sistema Alvo *" required variant="outlined" />}
              />
              {isEditing && currentRule.system && (
                  <FormHelperText>O sistema não pode ser alterado ao editar uma regra.</FormHelperText>
              )}
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                options={availableRuleTypes}
                getOptionLabel={(option) => option.label || ""}
                value={currentRule.ruleType}
                onChange={(event, newValue) => handleFormChange("ruleType", newValue)}
                isOptionEqualToValue={(option, value) => option.id === value?.id}
                disableClearable
                disabled={!currentRule.system}
                renderInput={(params) => <MDInput {...params} label="Tipo de Regra *" required variant="outlined" />}
              />
               {currentRule.system?.id === null && (
                  <FormHelperText>Regras globais não podem usar Perfil como critério.</FormHelperText>
               )}
            </Grid>

            <DynamicRuleFields
              ruleType={currentRule.ruleType}
              resources={filteredResources} 
              systems={availableSystemsForValueB} 
              attributes={allAttributes} 
              values={{
                valueASelection: currentRule.valueASelection,
                valueAOperator: currentRule.valueAOperator,
                valueAValue: currentRule.valueAValue,
                valueBSelection: currentRule.valueBSelection,
              }}
              onChange={handleFormChange}
              isDisabled={!currentRule.system || !currentRule.ruleType} 
            />

          </Grid>
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton onClick={handleClose} color="secondary"> Cancelar </MDButton>
        <MDButton onClick={handleSubmit} variant="gradient" color="info">
          {isEditing ? "Salvar Alterações" : "Criar Regra"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

SodModal.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onRefresh: PropTypes.func.isRequired,
  showSnackbar: PropTypes.func.isRequired,
  token: PropTypes.string,
  ruleToEdit: PropTypes.object,
  systems: PropTypes.arrayOf(PropTypes.object).isRequired,
  resources: PropTypes.arrayOf(PropTypes.object).isRequired, 
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

SodModal.defaultProps = {
  token: null,
  ruleToEdit: null,
  resources: [], 
};

export default SodModal;