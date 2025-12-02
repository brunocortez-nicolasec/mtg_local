// material-react-app/src/layouts/observabilidade/politicas/components/sod/SodTable.js

import React, { useMemo } from "react"; // Adicionado useMemo para performance
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
import { ruleTypes, comparisonOperators } from "./sodConfig";

function SodTable({ loading, rules, resources, systems, attributes, onEdit, onDelete }) {

  // Função helper: Retorna APENAS o nome (string) ou null/undefined
  const findItemName = (type, id) => {
      if (!type || !id) return id || 'N/A'; 
      let list;
      let keyField = 'id';
      let idToCompare = id;

      switch (type) {
          case 'PROFILE':
              list = resources; 
              idToCompare = parseInt(id, 10);
              break;
          case 'SYSTEM':
              list = systems;
              idToCompare = parseInt(id, 10);
              break;
          case 'ATTRIBUTE':
              list = attributes;
              break;
          default:
              return id; 
      }

      if (!Array.isArray(list)) {
          return `${id} (lista indisponível)`;
      }
      
      const found = list.find(item => item && item[keyField] === idToCompare);
      
      // Formata o nome do Recurso para "NOME_RECURSO (NOME_SISTEMA)"
      if (type === 'PROFILE' && found) {
          return `${found.name_resource} (${found.system?.name_system || 'Sistema Desconhecido'})`;
      }

      return found ? found.name : `${id} (não encontrado)`;
  };

  const sodColumns = [
    { Header: "Nome da Regra", accessor: "name", width: "15%" }, 
    {
      Header: "Tipo",
      accessor: "ruleType",
      width: "15%", 
      Cell: ({ value }) => {
        const type = ruleTypes.find(rt => rt.id === value);
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
      Header: "Valor A",
      accessor: "valueAId",
      width: "25%", 
      Cell: ({ row }) => {
        const { valueAType, valueAId, valueAOperator, valueAValue } = row.original;
        const nameA = findItemName(valueAType, valueAId); 

        if (valueAType === 'ATTRIBUTE') {
           const opLabel = comparisonOperators.find(op => op.id === valueAOperator)?.label || valueAOperator || '(?)';
           const displayValue = valueAValue !== null && typeof valueAValue !== 'undefined' ? `"${valueAValue}"` : '';
           return (
             <MDTypography variant="caption" title={`${nameA} ${opLabel} ${displayValue}`}>
                 {`${nameA} ${opLabel} ${displayValue}`}
             </MDTypography>
           );
        }
        return <MDTypography variant="caption">{nameA}</MDTypography>;
      }
    },
    {
      Header: "Valor B",
      accessor: "valueBId",
      width: "15%", 
      Cell: ({ row }) => {
        const nameB = findItemName(row.original.valueBType, row.original.valueBId);
        return <MDTypography variant="caption">{nameB}</MDTypography>;
       }
    },
    { 
      Header: "Sistema", 
      accessor: "system.name_system", 
      Cell: ({ value }) => <MDTypography variant="caption">{value || "Global"}</MDTypography>, 
      width: "10%" 
    },
    {
      Header: "Ações",
      accessor: "actions",
      align: "center",
      width: "10%",
      Cell: ({ row: { original } }) => (
        <MDBox display="flex" justifyContent="center">
          <Tooltip title="Editar">
            <IconButton onClick={() => onEdit(original)} size="small" >
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

  // --- BLINDAGEM DO ARRAY DE REGRAS ---
  // Garante que a tabela nunca receba null/undefined
  const safeRules = useMemo(() => Array.isArray(rules) ? rules : [], [rules]);

  if (loading) {
    return (
      <MDBox p={3} sx={{ textAlign: "center" }}>
        <CircularProgress color="info" />
        <MDTypography variant="body2" color="text" sx={{ mt: 2 }}>
          Carregando regras de SOD...
        </MDTypography>
      </MDBox>
    );
  }

  return (
    <DataTable
      table={{ columns: sodColumns, rows: safeRules }}
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

SodTable.propTypes = {
  loading: PropTypes.bool.isRequired,
  rules: PropTypes.arrayOf(PropTypes.object), // Removido isRequired para evitar warning se inicializar null
  resources: PropTypes.arrayOf(PropTypes.object).isRequired, 
  systems: PropTypes.arrayOf(PropTypes.object).isRequired,
  attributes: PropTypes.arrayOf(PropTypes.object).isRequired,
  onEdit: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};

// Valores padrão para segurança
SodTable.defaultProps = {
  rules: [],
  resources: [],
  systems: [],
  attributes: [],
};

export default SodTable;