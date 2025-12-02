/* eslint-disable react/prop-types */
/* eslint-disable react/function-component-definition */

import MDTypography from "components/MDTypography";
import MDAvatar from "components/MDAvatar";
import MDBox from "components/MDBox";
import defaultAvatar from "assets/images/default-avatar.jpg";

// Novos imports para os ícones e tooltip
import Icon from "@mui/material/Icon";
import Tooltip from "@mui/material/Tooltip";

function Author({ image, name }) {
  return (
    <MDBox display="flex" alignItems="center" lineHeight={1}>
      <MDAvatar src={image || defaultAvatar} name={name} size="sm" />
      <MDBox ml={2} lineHeight={1}>
        <MDTypography display="block" variant="button" fontWeight="medium">
          {name}
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}

function Action({ onEdit, onDelete, onReset }) {
  return (
    <MDBox display="flex" alignItems="center" justifyContent="center">
      
      {/* Botão RESET - Cor Warning (Laranja/Amarelo) */}
      <Tooltip title="Resetar Senha" placement="top">
        <MDBox mx={1} sx={{ cursor: "pointer" }}>
           <MDTypography variant="body2" color="warning" onClick={onReset}>
              <Icon fontSize="small">lock_reset</Icon>
           </MDTypography>
        </MDBox>
      </Tooltip>

      {/* Botão EDITAR - Cor Info (Azul) */}
      <Tooltip title="Editar Usuário" placement="top">
        <MDBox mx={1} sx={{ cursor: "pointer" }}>
           <MDTypography variant="body2" color="info" onClick={onEdit}>
              <Icon fontSize="small">edit</Icon>
           </MDTypography>
        </MDBox>
      </Tooltip>

      {/* Botão DELETAR - Cor Error (Vermelho) */}
      <Tooltip title="Deletar Usuário" placement="top">
        <MDBox mx={1} sx={{ cursor: "pointer" }}>
           <MDTypography variant="body2" color="error" onClick={onDelete}>
              <Icon fontSize="small">delete</Icon>
           </MDTypography>
        </MDBox>
      </Tooltip>

    </MDBox>
  );
}

export default function data(users, handleEdit, handleDelete, handleReset) {
  const columns = [
    { Header: "usuário", accessor: "user", width: "30%", align: "left" },
    { Header: "email", accessor: "email", align: "left" },
    { Header: "função", accessor: "role", align: "center" },
    { Header: "pacote", accessor: "package", align: "center" },
    { Header: "criado em", accessor: "created", align: "center" },
    { Header: "ação", accessor: "action", align: "center" },
  ];

  const rows = (users || []).map(user => ({
    user: <Author image={user.profile_image} name={user.name} />,
    email: <MDTypography variant="caption">{user.email}</MDTypography>,
    role: <MDTypography variant="caption">{user.profile?.name || "Sem função"}</MDTypography>,
    package: (
      <MDTypography variant="caption" color="text" fontWeight="medium">
        {user.package?.name || "Nenhum"}
      </MDTypography>
    ),
    created: (
      <MDTypography variant="caption">
        {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "N/A"}
      </MDTypography>
    ),
    action: (
      <Action 
        onEdit={() => handleEdit(user)} 
        onDelete={() => handleDelete(user.id)}
        onReset={() => handleReset(user)} 
      />
    ),
  }));

  return { columns, rows };
}