import { useEffect, useMemo } from "react";
import { useLocation, NavLink } from "react-router-dom";
import PropTypes from "prop-types";
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav"; 
import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
} from "context";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode, user } = controller;
  const location = useLocation();
  const collapseName = location.pathname.replace("/", "");

  const { userRole, userPackage, userPlatformKeys } = useMemo(() => {
    // --- CORREÇÃO DE LEITURA DE PERFIL ---
    if (!user) {
        return { userRole: null, userPackage: null, userPlatformKeys: [] };
    }

    // Tenta ler do formato limpo (App.js novo) ou do formato bruto (fallback)
    // Se o user já vier formatado, 'role' está na raiz. Se não, está em data.attributes.
    const attributes = user.data?.attributes || user;
    
    // O backend envia 'role' (string) ou 'profile' (objeto)
    // Precisamos normalizar para pegar o nome da role
    const roleName = attributes.role || (attributes.profile ? attributes.profile.name : null);
    
    const userPackage = attributes.package;
    const userPlatformKeys = userPackage?.platforms?.map((p) => p.key) || [];
    
    return { userRole: roleName, userPackage, userPlatformKeys };
    // --------------------------------------
  }, [user]);

  let textColor = "white";
  if (transparentSidenav || (whiteSidenav && !darkMode)) {
    textColor = "dark";
  } else if (whiteSidenav && darkMode) {
    textColor = "inherit";
  }

  const closeSidenav = () => setMiniSidenav(dispatch, true);

  useEffect(() => {
    function handleCloseSidenavOnRoute() {
      if (window.innerWidth < 1200) {
        setMiniSidenav(dispatch, true);
      }
    }
    window.addEventListener("resize", handleCloseSidenavOnRoute);
    handleCloseSidenavOnRoute();
    return () => window.removeEventListener("resize", handleCloseSidenavOnRoute);
  }, [dispatch, location]);

  useEffect(() => {
    function handleTransparentSidenav() {
      setTransparentSidenav(dispatch, window.innerWidth < 1200 ? false : transparentSidenav);
      setWhiteSidenav(dispatch, window.innerWidth < 1200 ? false : whiteSidenav);
    }
    window.addEventListener("resize", handleTransparentSidenav);
    handleTransparentSidenav(); 
    return () => window.removeEventListener("resize", handleTransparentSidenav);
  }, [dispatch, transparentSidenav, whiteSidenav]);


  const renderRoutes = routes.map(
    ({ type, name, icon, title, noCollapse, key, href, route, collapse, role }) => {
      let returnValue;

      // --- FILTRO DE ROLE ---
      // Se a rota tem uma role definida (ex: "Admin") e o usuário não tem essa role, esconde.
      if (role && role !== userRole) {
        return null;
      }

      if (key === "tas") {
        const isAdmin = userRole === "Admin";
        if (!isAdmin && !userPackage) {
          return null;
        }
        let platformsToShow = collapse;
        if (!isAdmin && userPackage) {
          platformsToShow = collapse.filter((platform) => userPlatformKeys.includes(platform.key));
        }
        if (platformsToShow.length === 0) {
          return null;
        }

        returnValue = (
          <SidenavCollapse
            key={key}
            name={name}
            icon={icon}
            active={location.pathname.startsWith(`/${key}`)}
            collapse={platformsToShow}
          />
        );
      } else if (type === "collapse") {
        if (collapse) {
          returnValue = (
            <SidenavCollapse
              key={key}
              name={name}
              icon={icon}
              active={location.pathname.startsWith(`/${key}`)}
              collapse={collapse}
            />
          );
        } else if (href) {
          returnValue = (
            <Link
              href={href}
              key={key}
              target="_blank"
              rel="noreferrer"
              sx={{ textDecoration: "none" }}
            >
              <SidenavCollapse
                name={name}
                icon={icon}
                active={key === collapseName}
                noCollapse={noCollapse}
              />
            </Link>
          );
        } else {
          returnValue = (
            <NavLink key={key} to={route}>
              <SidenavCollapse name={name} icon={icon} active={key === collapseName} />
            </NavLink>
          );
        }
      } else if (type === "title") {
        returnValue = (
          <MDTypography
            key={key}
            color={textColor}
            display="block"
            variant="caption"
            fontWeight="bold"
            textTransform="uppercase"
            pl={3}
            mt={2}
            mb={1}
            ml={1}
          >
            {title}
          </MDTypography>
        );
      } else if (type === "divider") {
        returnValue = (
          <Divider
            key={key}
            light={
              (!darkMode && !whiteSidenav && !transparentSidenav) ||
              (darkMode && !transparentSidenav && whiteSidenav)
            }
          />
        );
      }
      return returnValue;
    }
  );

  return (
    <SidenavRoot
      {...rest}
      variant="permanent"
      ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
    >
      <MDBox pt={3} pb={1} px={4} textAlign="center">
        <MDBox
          display={{ xs: "block", xl: "none" }}
          position="absolute"
          top={0}
          right={0}
          p={1.625}
          onClick={closeSidenav} 
          sx={{ cursor: "pointer" }}
        >
          <MDTypography variant="h6" color="secondary">
            <Icon sx={{ fontWeight: "bold" }}>close</Icon>
          </MDTypography>
        </MDBox>
        <MDBox component={NavLink} to="/" display="flex" alignItems="center" justifyContent="center">
          {brand && <MDBox component="img" src={brand} alt="Brand" width="2rem" />}
          {brandName && (
            <MDBox
              width={!brandName && "100%"}
              sx={(theme) => sidenavLogoLabel(theme, { miniSidenav })} 
            >
              <MDTypography component="h6" variant="button" fontWeight="medium" color={textColor}>
                {brandName}
              </MDTypography>
            </MDBox>
          )}
        </MDBox>
      </MDBox>

      <List sx={{ mb: 2 }}>
        <Divider
          light={
            (!darkMode && !whiteSidenav && !transparentSidenav) ||
            (darkMode && !transparentSidenav && whiteSidenav)
          }
        />
        {renderRoutes}
      </List>

      <MDBox
        sx={(theme) => ({
          marginTop: "auto",
          ...sidenavLogoLabel(theme, { miniSidenav }), 
          paddingTop: "1rem", 
          paddingBottom: "1rem", 
          textAlign: "center",
        })}
      >
        <MDTypography variant="caption" color={textColor}>
          Versão 2.0.0
        </MDTypography>
      </MDBox>
    </SidenavRoot>
  );
}

Sidenav.defaultProps = {
  color: "info",
  brand: "",
  brandName: "",
};

Sidenav.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  brand: PropTypes.string,
  brandName: PropTypes.string,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;