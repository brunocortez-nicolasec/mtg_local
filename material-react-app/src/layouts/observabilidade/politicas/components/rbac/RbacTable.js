// material-react-app/src/layouts/observabilidade/politicas/components/rbac/RbacTable.js

import React, { useMemo } from "react";
import PropTypes from 'prop-types'; 

// @mui material components
import CircularProgress from "@mui/material/CircularProgress";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DataTable from "examples/Tables/DataTable";

// Configs
import { conditionTypes, comparisonOperators, logicalOperators } from "./rbacConfig";

function RbacTable({ loading, rules, resources, attributes, onEdit, onDelete }) {

  // Garante que as listas de lookup sejam arrays para evitar crash no .find()
  const safeResources = Array.isArray(resources) ? resources : [];
  const safeAttributes = Array.isArray(attributes) ? attributes : [];

  const getConditionDisplay = (rule) => {
    switch (rule.conditionType) {
      case "BY_PROFILE": { 
        const reqProfileName = safeResources.find((p) => p.id === rule.requiredResourceId)?.name_resource;
        return `Requer Recurso: ${reqProfileName || `(ID: ${rule.requiredResourceId || '?'})`}`;
      }
      case "BY_SINGLE_ATTRIBUTE": {
        const attrName = safeAttributes.find((a) => a.id === rule.attributeName)?.name || rule.attributeName; 
        const opLabelSingle =
          comparisonOperators.find((op) => op.id === rule.attributeOperator)?.label ||
          rule.attributeOperator || '(?)'; 
        return `Atributo: ${attrName} ${opLabelSingle} "${rule.attributeValue}"`;
      }
      case "BY_MULTIPLE_ATTRIBUTES": {
        if (!Array.isArray(rule.attributeConditions) || rule.attributeConditions.length === 0)
          return "(Nenhuma condição)";
        const logicLabel = logicalOperators.find((lo) => lo.id === rule.logicalOperator)?.id || "E";
        return rule.attributeConditions
          .map((cond) => {
            const attrNameCond = safeAttributes.find((a) => a.id === cond.attributeName)?.name || cond.attributeName; 
            const opLabelMulti = comparisonOperators.find((op) => op.id === cond.operator)?.label || cond.operator || '(?)'; 
            return `(${attrNameCond} ${opLabelMulti} "${cond.attributeValue}")`;
          })
          .join(` ${logicLabel} `);
        }
      default:
        return "(Condição desconhecida)";
    }
  };

  const rbacColumns = [
    { Header: "Nome da Regra", accessor: "name", width: "15%" }, 
    { 
      Header: "Sistema", 
      accessor: "system.name_system", 
      width: "15%",
      // Proteção contra sistema nulo
      Cell: ({ row }) => (
          <MDTypography variant="caption">
              {row.original.system?.name_system || '(Inválido)'}
          </MDTypography>
      )
    },
    {
      Header: "Tipo Condição",
      accessor: "conditionType",
      width: "15%", 
      Cell: ({ value }) => {
          const type = conditionTypes.find((ct) => ct.id === value);
           return (
             <Tooltip title={type?.label || value}>
                 <MDTypography variant="caption" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                     {type?.label || value}
                 </MDTypography>
             </Tooltip>
           );
       }
    },
    {
      Header: "Condição",
      accessor: "conditionDisplay",
      Cell: ({ row }) => getConditionDisplay(row.original),
      width: "30%", 
    },
    {
      Header: "Recurso Concedido", 
      accessor: "grantedResource.name_resource", 
      width: "15%", 
      // Proteção contra recurso nulo
      Cell: ({ row }) => (
          <MDTypography variant="caption">
              {row.original.grantedResource?.name_resource || '(Inválido)'}
          </MDTypography>
      ), 
    },
    { Header: "Owner", accessor: "owner", Cell: ({ value }) => <MDTypography variant="caption">{value || "N/A"}</MDTypography>, width: "10%" }, 
    {
      Header: "Ações",
      accessor: "actions",
      align: "center",
      width: "10%",
      Cell: ({ row: { original } }) => (
        <MDBox display="flex" justifyContent="center"> 
          <Tooltip title="Editar">
            <IconButton onClick={() => onEdit(original)} size="small"> 
              <Icon color="info">edit</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title="Deletar">
            <IconButton color="error" onClick={() => onDelete(original.id)} size="small"> 
              <Icon>delete</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      ),
    },
  ];

  // --- BLINDAGEM PRINCIPAL DO ARRAY DE REGRAS ---
  // Garante que o componente DataTable nunca receba undefined
  const safeRules = useMemo(() => Array.isArray(rules) ? rules : [], [rules]);

  if (loading) {
    return (
      <MDBox p={3} sx={{ textAlign: "center" }}>
        <CircularProgress color="info" />
        <MDTypography variant="body2" color="text" sx={{ mt: 2 }}>
          Carregando regras RBAC...
        </MDTypography>
      </MDBox>
    );
  }

  return (
    <DataTable
      table={{ columns: rbacColumns, rows: safeRules }}
      isSorted={true}
      entriesPerPage={true}
      showTotalEntries={true}
      canSearch={true}
      pagination={{ variant: "gradient", color: "info" }}
      tableProps={{ size: 'small' }} 
      noEndBorder 
    />
  );
}

RbacTable.propTypes = {
  loading: PropTypes.bool.isRequired,
  rules: PropTypes.arrayOf(PropTypes.object), // Removido isRequired para segurança
  resources: PropTypes.arrayOf(PropTypes.object).isRequired, 
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// Defaults para evitar crash
RbacTable.defaultProps = {
    rules: [],
    resources: [],
    attributes: []
};

export default RbacTable;