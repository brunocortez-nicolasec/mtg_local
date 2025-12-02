// material-react-app/src/layouts/observabilidade/politicas/components/sod/DynamicRuleFields.js

import React from "react";
import PropTypes from 'prop-types';

// @mui material components
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";

// Material Dashboard 2 React components
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import { useMaterialUIController } from "context";

// Config
import { comparisonOperators } from "./sodConfig";

function DynamicRuleFields({
  ruleType,
  resources, 
  systems,
  attributes,
  values, 
  onChange, 
  isDisabled, 
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  // Função interna para renderizar os campos de Atributo
  const renderAttributeFields = (valueField, operatorField, valueValueField) => (
    <>
      <Grid item xs={12} sm={4}>
        <Autocomplete
          options={Array.isArray(attributes) ? attributes : []} // Blindagem
          getOptionLabel={(option) => option.name || ""}
          value={values[valueField]} 
          onChange={(event, newValue) => onChange(valueField, newValue)}
          isOptionEqualToValue={(option, value) => option.id === value?.id}
          disabled={isDisabled} 
          renderInput={(params) => <MDInput {...params} label="Atributo *" required variant="outlined" />}
        />
      </Grid>
      <Grid item xs={12} sm={3}>
        <Autocomplete
          options={comparisonOperators}
          getOptionLabel={(option) => option.label || ""}
          value={values[operatorField]} 
          onChange={(event, newValue) => onChange(operatorField, newValue)}
          isOptionEqualToValue={(option, value) => option.id === value?.id}
          disableClearable
          disabled={isDisabled} 
          renderInput={(params) => <MDInput {...params} label="Operador *" required variant="outlined" />}
        />
      </Grid>
      <Grid item xs={12} sm={5}>
        <MDInput
          label="Valor do Atributo *"
          name={valueValueField} 
          value={values[valueValueField] || ""} 
          onChange={(e) => onChange(e.target.name, e.target.value)} 
          fullWidth
          required
          disabled={isDisabled} 
          variant="outlined"
        />
      </Grid>
    </>
  );

  // Função interna para renderizar campo de Perfil (Recurso)
  const renderProfileField = (valueField, label = "Perfil *") => (
    <Grid item xs={12} sm={6}>
      <Autocomplete
        options={Array.isArray(resources) ? resources : []} // Blindagem
        // Formata o nome para exibir o sistema junto
        getOptionLabel={(option) => {
            if (!option) return "";
            const sysName = option.system?.name_system || 'Global';
            return `${option.name_resource} (${sysName})`;
        }}
        value={values[valueField]} 
        onChange={(event, newValue) => onChange(valueField, newValue)}
        isOptionEqualToValue={(option, value) => option.id === value?.id}
        disabled={isDisabled} 
        renderInput={(params) => <MDInput {...params} label={label} required variant="outlined" />}
      />
    </Grid>
  );

   // Função interna para renderizar campo de Sistema
   const renderSystemField = (valueField, label = "Sistema *") => (
    <Grid item xs={12} sm={6}>
      <Autocomplete
        options={Array.isArray(systems) ? systems : []} // Blindagem
        getOptionLabel={(option) => option.name || ""}
        value={values[valueField]} 
        onChange={(event, newValue) => onChange(valueField, newValue)}
        isOptionEqualToValue={(option, value) => option.id === value?.id}
        disabled={isDisabled} 
        renderInput={(params) => <MDInput {...params} label={label} required variant="outlined" />}
      />
    </Grid>
  );


  // Renderização principal baseada no ruleType
  switch (ruleType?.id) {
    case "ROLE_X_ROLE":
      return (
        <>
          {renderProfileField("valueASelection", "Recurso Conflitante A *")}
          {renderProfileField("valueBSelection", "Recurso Conflitante B *")}
        </>
      );
    case "ATTR_X_ROLE":
      return (
        <>
          {renderAttributeFields("valueASelection", "valueAOperator", "valueAValue")}
          {renderProfileField("valueBSelection", "Recurso Conflitante *")}
        </>
      );
    case "ATTR_X_SYSTEM":
      return (
        <>
          {renderAttributeFields("valueASelection", "valueAOperator", "valueAValue")}
           {renderSystemField("valueBSelection", "Sistema Conflitante *")}
        </>
      );
    default:
      return (
          <Grid item xs={12}>
            <MDTypography variant="caption" color="text">
                Selecione um Sistema Alvo e um Tipo de Regra...
            </MDTypography>
          </Grid>
      );
  }
}

DynamicRuleFields.propTypes = {
  ruleType: PropTypes.object,
  resources: PropTypes.arrayOf(PropTypes.object).isRequired, 
  systems: PropTypes.arrayOf(PropTypes.object).isRequired,
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  isDisabled: PropTypes.bool, 
};

DynamicRuleFields.defaultProps = {
  isDisabled: false, 
  ruleType: null,
};

export default DynamicRuleFields;