// material-react-app/src/layouts/observabilidade/mapeamentoDados/components/MappingForm.js

import React from "react";
import PropTypes from "prop-types";

// @mui material components
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import Autocomplete from "@mui/material/Autocomplete";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import { useMaterialUIController } from "context";

function MappingForm({ 
  title, 
  description, 
  fields, 
  availableColumns, 
  onMappingChange, 
  onSave, 
  isSaveDisabled, 
  loading 
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  return (
    <Grid container spacing={3}>
      <Grid item xs={12}>
        <Card sx={{ height: "100%" }}>
          <MDBox
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
            p={2}
            mx={2}
            mt={-3}
          >
            <MDTypography variant="h6" color="white">
              {title}
            </MDTypography>
          </MDBox>
          <MDBox pt={3} px={3}>
            <MDTypography variant="body2" color="text" mb={2}>
              {description}
            </MDTypography>
            <List>
              {fields.map((field) => (
                <ListItem 
                  key={field.key} 
                  sx={{ 
                    display: 'flex', 
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    py: 1.5, 
                    px: 0, 
                    borderBottom: '1px solid', 
                    borderColor: 'divider' 
                  }}
                >
                  <MDBox flex="1 1 40%" pr={2} mb={{ xs: 1.5, sm: 0 }} sx={{width: '100%'}}>
                    <MDTypography variant="button" fontWeight="medium" color="text">
                      {field.key}
                      {field.required && (
                        <MDTypography component="span" variant="button" fontWeight="medium" color="error" sx={{ ml: 0.5 }}>
                          *
                        </MDTypography>
                      )}
                    </MDTypography>
                  </MDBox>
                  <MDBox flex="1 1 60%" sx={{width: '100%'}}>
                    <Autocomplete
                      options={availableColumns}
                      value={field.value || null} 
                      onChange={(event, newValue) => {
                        onMappingChange(field.key, newValue);
                      }}
                      getOptionDisabled={(option) => {
                         const allValues = fields.map(f => f.value).filter(Boolean);
                         return allValues.includes(option) && option !== field.value;
                      }}
                      ListboxProps={{
                        sx: { },
                      }}
                      renderInput={(params) => (
                        <MDInput 
                          {...params} 
                          label="Selecionar Coluna" 
                          variant="outlined" 
                          helperText={field.description}
                          FormHelperTextProps={{ 
                            sx: { 
                              // --- CORREÇÃO AQUI ---
                              // Força a cor branca no modo escuro
                              color: darkMode ? "#ffffff" : (theme) => theme.palette.text.secondary,
                              opacity: darkMode ? 0.8 : 1, // Um pouco de transparência para ficar elegante
                              fontSize: '0.75rem',
                              marginLeft: 0 
                            } 
                          }}
                        /> 
                      )}
                      sx={{ minWidth: "200px" }}
                    />
                  </MDBox>
                </ListItem>
              ))}
            </List>
          </MDBox>
        </Card>
      </Grid>

      <Grid item xs={12}>
        <MDBox display="flex" justifyContent="flex-end" mt={3}>
          <MDButton 
            variant="gradient" 
            color="info" 
            onClick={onSave}
            disabled={isSaveDisabled || loading}
          >
            {loading ? "Salvando..." : "Salvar Mapeamento"}
          </MDButton> 
        </MDBox>
      </Grid>
    </Grid>
  );
}

MappingForm.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  fields: PropTypes.arrayOf(PropTypes.object).isRequired,
  availableColumns: PropTypes.arrayOf(PropTypes.string).isRequired,
  onMappingChange: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  isSaveDisabled: PropTypes.bool,
  loading: PropTypes.bool
};

export default MappingForm;