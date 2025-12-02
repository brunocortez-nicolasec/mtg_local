// material-react-app/src/layouts/observabilidade/politicas/components/rbac/DynamicConditionFields.js

import React from "react";
import PropTypes from 'prop-types';

// @mui material components
import Autocomplete from "@mui/material/Autocomplete";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Button from "@mui/material/Button";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput"; 
import { useMaterialUIController } from "context"; 

// Importa as configs
import { comparisonOperators, logicalOperators } from "./rbacConfig";

// Componente para campos dinâmicos
function DynamicConditionFields({
  conditionType,
  resources, 
  attributes,
  values,
  onChange,
  onSingleAttrChange,
  onListChange,
  onAddCondition,
  onRemoveCondition,
  isDisabled, 
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  switch (conditionType?.id) {
    case "BY_PROFILE":
      return (
        <Grid item xs={12}>
          <Autocomplete
            options={Array.isArray(resources) ? resources : []} // Blindagem de Array
            // Formata nome com sistema
            getOptionLabel={(option) => `${option.name_resource} (${option.system?.name_system || 'Global'})` || ""}
            value={values.requiredProfile}
            onChange={(event, newValue) => onChange(event, "requiredProfile", newValue)}
            isOptionEqualToValue={(option, value) => option?.id === value?.id}
            disabled={isDisabled} 
            renderInput={(params) => <MDInput {...params} label="Recurso Requerido *" required variant="outlined" />}
          />
        </Grid>
      );
    case "BY_SINGLE_ATTRIBUTE":
      return (
        <>
          <Grid item xs={12} sm={5}>
            <Autocomplete
              options={Array.isArray(attributes) ? attributes : []} // Blindagem de Array
              getOptionLabel={(option) => option.name || ""}
              value={values.singleAttributeCondition.attribute}
              onChange={(event, newValue) => onSingleAttrChange("attribute", newValue)}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              disabled={isDisabled} 
              renderInput={(params) => (
                <MDInput {...params} label="Atributo Requerido *" required variant="outlined" />
              )}
            />
          </Grid>

          <Grid item xs={12} sm={3}>
            <Autocomplete
              options={comparisonOperators}
              getOptionLabel={(option) => option.label || ""}
              value={values.singleAttributeCondition.operator}
              onChange={(event, newValue) => onSingleAttrChange("operator", newValue)}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              disableClearable
              disabled={isDisabled} 
              renderInput={(params) => <MDInput {...params} label="Operador *" required variant="outlined" />}
            />
          </Grid>

          <Grid item xs={12} sm={4}>
            <MDInput
              label="Valor do Atributo *"
              value={values.singleAttributeCondition.value}
              onChange={(e) => onSingleAttrChange("value", e.target.value)}
              fullWidth
              required
              disabled={isDisabled} 
              variant="outlined"
            />
          </Grid>
        </>
      );
    case "BY_MULTIPLE_ATTRIBUTES":
      return (
        <Grid item xs={12}>
          <Grid item xs={12} md={6} sx={{ mb: 2 }}>
            <Autocomplete
              options={logicalOperators}
              getOptionLabel={(option) => option.label || ""}
              value={values.logicalOperator}
              onChange={(event, newValue) => onChange(event, "logicalOperator", newValue)}
              isOptionEqualToValue={(option, value) => option?.id === value?.id}
              disableClearable
              disabled={isDisabled} 
              renderInput={(params) => <MDInput {...params} label="Lógica das Condições *" required variant="outlined" />}
            />
          </Grid>
          <MDTypography variant="subtitle2" gutterBottom>
            Condições de Atributo
          </MDTypography>
          <List dense sx={{ width: "100%" }}>
            {values.attributeConditions.map((condition, index) => (
              <ListItem
                key={index}
                disableGutters
                sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 1.5 }}
              >
                <Autocomplete
                  options={Array.isArray(attributes) ? attributes : []} // Blindagem de Array
                  getOptionLabel={(option) => option.name || ""}
                  value={condition.attribute}
                  onChange={(event, newValue) => onListChange(index, "attribute", newValue)}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  disabled={isDisabled} 
                  renderInput={(params) => (
                    <MDInput {...params} label={`Atributo ${index + 1} *`} required variant="outlined" />
                  )}
                  sx={{ width: { xs: "100%", sm: "calc(35% - 8px)" } }}
                />

                <Autocomplete
                  options={comparisonOperators}
                  getOptionLabel={(option) => option.label || ""}
                  value={condition.operator}
                  onChange={(event, newValue) => onListChange(index, "operator", newValue)}
                  isOptionEqualToValue={(option, value) => option?.id === value?.id}
                  disableClearable
                  disabled={isDisabled} 
                  renderInput={(params) => <MDInput {...params} label="Operador *" required variant="outlined" />}
                  sx={{ width: { xs: "100%", sm: "calc(25% - 8px)" } }}
                />

                <MDInput
                  label={`Valor ${index + 1} *`}
                  value={condition.value}
                  onChange={(e) => onListChange(index, "value", e.target.value)}
                  required
                  disabled={isDisabled} 
                  variant="outlined"
                  sx={{ width: { xs: "calc(100% - 40px)", sm: "calc(40% - 12px)" } }}
                />
                <Tooltip title="Remover Condição">
                  <IconButton
                    onClick={() => onRemoveCondition(index)}
                    color="error"
                    size="small"
                    disabled={values.attributeConditions.length <= 1 || isDisabled} 
                    sx={{ width: "40px" }}
                  >
                    <Icon>remove_circle_outline</Icon>
                  </IconButton>
                </Tooltip>
              </ListItem>
            ))}
          </List>
          <Button startIcon={<Icon>add</Icon>} onClick={onAddCondition} size="small" disabled={isDisabled}> 
            Adicionar Condição
          </Button>
        </Grid>
      );
    default:
      return (
        <Grid item xs={12}>
          <MDTypography variant="caption" color="text">
            Selecione um Sistema e um Tipo de Condição...
          </MDTypography>
        </Grid>
      );
  }
}

DynamicConditionFields.propTypes = {
  conditionType: PropTypes.object,
  resources: PropTypes.arrayOf(PropTypes.object).isRequired, 
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
  values: PropTypes.object.isRequired,
  onChange: PropTypes.func.isRequired,
  onSingleAttrChange: PropTypes.func.isRequired,
  onListChange: PropTypes.func.isRequired,
  onAddCondition: PropTypes.func.isRequired,
  onRemoveCondition: PropTypes.func.isRequired,
  isDisabled: PropTypes.bool, 
};

DynamicConditionFields.defaultProps = {
  isDisabled: false, 
  conditionType: null,
};

export default DynamicConditionFields;