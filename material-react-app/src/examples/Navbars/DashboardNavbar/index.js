import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import NotificationItem from "examples/Items/NotificationItem";
// import AuthService from "services/auth-service"; // <-- AuthService antigo não é mais necessário para logout
import brandLogoLight from "assets/images/mtg_azul_sem_fundo.png"; 
import brandLogoDark from "assets/images/mtg_branco_sem_fundo.png"; 
import {
  navbar,
  navbarContainer,
  navbarRow,
  navbarIconButton,
  navbarMobileMenu,
} from "examples/Navbars/DashboardNavbar/styles";

import {
  useMaterialUIController,
  setTransparentNavbar,
  setMiniSidenav,
  setOpenConfigurator,
  logout,
} from "context";

// --- IMPORTAÇÃO DO KEYCLOAK ---
import { useKeycloak } from "@react-keycloak/web";

function DashboardNavbar({ absolute, light, isMini }) {
  const [navbarType, setNavbarType] = useState();
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav, transparentNavbar, fixedNavbar, openConfigurator, darkMode } = controller;
  const [openMenu, setOpenMenu] = useState(false);
  const [userMenu, setUserMenu] = useState(null);
  const navigate = useNavigate();

  // --- HOOK DO KEYCLOAK ---
  const { keycloak } = useKeycloak();

  useEffect(() => {
    if (fixedNavbar) {
      setNavbarType("sticky");
    } else {
      setNavbarType("static");
    }
    function handleTransparentNavbar() {
      setTransparentNavbar(dispatch, (fixedNavbar && window.scrollY === 0) || !fixedNavbar);
    }
    window.addEventListener("scroll", handleTransparentNavbar);
    handleTransparentNavbar();
    return () => window.removeEventListener("scroll", handleTransparentNavbar);
  }, [dispatch, fixedNavbar]);

  const handleMiniSidenav = () => setMiniSidenav(dispatch, !miniSidenav);
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);
  const handleOpenMenu = (event) => setOpenMenu(event.currentTarget);
  const handleCloseMenu = () => setOpenMenu(false);
  const handleOpenUserMenu = (event) => setUserMenu(event.currentTarget);
  const handleCloseUserMenu = () => setUserMenu(null);

  const renderMenu = () => (
    <Menu
      anchorEl={openMenu}
      anchorReference={null}
      anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
      open={Boolean(openMenu)}
      onClose={handleCloseMenu}
      sx={{ mt: 2 }}
    >
      <NotificationItem icon={<Icon>email</Icon>} title="Check new messages" />
      <NotificationItem icon={<Icon>podcasts</Icon>} title="Manage Podcast sessions" />
      <NotificationItem icon={<Icon>shopping_cart</Icon>} title="Payment successfully completed" />
    </Menu>
  );

  const defaultIconStyle = ({ palette: { dark, white }}) => ({
    color: () => {
      if (darkMode || light) {
        return white.main;
      }
      return dark.main;
    },
    transition: 'transform 0.2s ease-in-out',
    '&:hover': {
      transform: 'scale(1.1)',
    },
  });

  const userIconStyle = ({ palette: { white, info } }) => ({
    color: () => (light ? white.main : info.main),
    fontSize: 'inherit !important',
    transition: 'color 0.2s ease-in-out, transform 0.2s ease-in-out',
    '&:hover': {
      transform: 'scale(1.1)',
    },
  });

  // --- FUNÇÃO DE LOGOUT ATUALIZADA ---
  const handleLogOut = () => {
    // 1. Limpa o estado local do React (Context)
    logout(dispatch);
    
    // 2. Chama o logout do Keycloak para matar a sessão no servidor TAS
    // O redirectUri define para onde o usuário volta após sair
    if (keycloak) {
        keycloak.logout({
            redirectUri: window.location.origin + '/mind-the-gap/auth/login'
        });
    } else {
        // Fallback caso keycloak não esteja injetado (raro)
        navigate("/auth/login");
    }
  };

  const handleLogoutAndCloseMenu = () => {
    handleCloseUserMenu();
    handleLogOut();
  };

  return (
    <AppBar
      position={absolute ? "absolute" : navbarType}
      color="inherit"
      sx={(theme) => navbar(theme, { transparentNavbar, absolute, light, darkMode })}
    >
      <Toolbar sx={(theme) => navbarContainer(theme)}>
        <MDBox color="inherit" mb={{ xs: 1, md: 0 }} sx={(theme) => navbarRow(theme, { isMini })}>
          <MDBox
            component="img"
            src={darkMode ? brandLogoDark : brandLogoLight} 
            alt="Mind The Gap Logo"
            sx={{
              maxHeight: "3.5rem",
              verticalAlign: "middle",
            }}
          />
        </MDBox>
        {isMini ? null : (
          <MDBox sx={(theme) => navbarRow(theme, { isMini })}>
            <MDBox color={light ? "white" : "inherit"} sx={{ display: "flex", alignItems: "center" }}>
              
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarIconButton} 
                onClick={handleMiniSidenav}
              >
                <Icon sx={defaultIconStyle} fontSize="medium">
                  {miniSidenav ? "menu_open" : "menu"}
                </Icon>
              </IconButton>
              
              <IconButton
                size="small"
                disableRipple
                color="inherit"
                sx={navbarMobileMenu} 
                onClick={handleMiniSidenav}
              >
                <Icon sx={defaultIconStyle} fontSize="medium">
                  {miniSidenav ? "menu_open" : "menu"}
                </Icon>
              </IconButton>
              
              <IconButton
                size="medium"
                disableRipple
                color="inherit"
                sx={{ ...navbarIconButton}}
                onClick={handleConfiguratorOpen}
              >
                <Icon sx={defaultIconStyle}>settings</Icon>
              </IconButton>
              
              <IconButton
                size="large"
                disableRipple
                color="inherit"
                sx={{ ...navbarIconButton}}
                onClick={handleOpenUserMenu}
              >
                <Icon sx={userIconStyle}>account_circle</Icon>
              </IconButton>

              <Menu
                anchorEl={userMenu}
                open={Boolean(userMenu)}
                onClose={handleCloseUserMenu}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem component={Link} to="/user-profile" onClick={handleCloseUserMenu}>
                  Perfil do Usuário
                </MenuItem>
                <MenuItem onClick={handleLogoutAndCloseMenu}>
                  Desconecte-se
                </MenuItem>
              </Menu>
              
              {renderMenu()}
            </MDBox>
          </MDBox>
        )}
      </Toolbar>
    </AppBar>
  );
}

DashboardNavbar.defaultProps = {
  absolute: false,
  light: false,
  isMini: false,
};

DashboardNavbar.propTypes = {
  absolute: PropTypes.bool,
  light: PropTypes.bool,
  isMini: PropTypes.bool,
};

export default DashboardNavbar;