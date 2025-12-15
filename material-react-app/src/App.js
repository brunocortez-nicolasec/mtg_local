//material-react-app/src/App.js

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Sidenav from "examples/Sidenav";
import Configurator from "examples/Configurator";
import theme from "assets/theme";
import themeRTL from "assets/theme/theme-rtl";
import themeDark from "assets/theme-dark";
import themeDarkRTL from "assets/theme-dark/theme-rtl";
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";
import routes from "routes";
import { useMaterialUIController, setMiniSidenav, logout, setAuth } from "context";
import { DashboardProvider } from "context/DashboardContext";
import axios from "axios"; 

// --- IMPORTAÇÃO DE SERVIÇOS ---
import HttpService, { setupAxios } from "services/htttp.service"; 
// ----------------------------

import { ReactKeycloakProvider, useKeycloak } from "@react-keycloak/web";
import keycloak from "./keycloak";

import CircularProgress from "@mui/material/CircularProgress";
import Box from "@mui/material/Box";
import brandWhite from "assets/images/mtg_icon_branco.png"; 
import brandDark from "assets/images/mtg_icon_azul.png"; 

import ProtectedRoute from "examples/ProtectedRoute";
import UserProfile from "layouts/user-profile";
import UserManagement from "layouts/user-management";
import MapeamentoDados from "layouts/observabilidade/mapeamentoDados";
import ForcePasswordChange from "components/ForcePasswordChange";

// 1. COMPONENTE DE SINCRONIZAÇÃO DE PERFIL
const UserProfileSync = () => {
  const { keycloak, initialized } = useKeycloak();
  const [controller, dispatch] = useMaterialUIController();
  const didFetchProfile = useRef(false);

  useEffect(() => {
    if (!initialized) return;

    if (keycloak.authenticated && !didFetchProfile.current) {
        didFetchProfile.current = true;
        
        const fetchMe = async () => {
             try {
               console.log(">>> [APP] Buscando dados do usuário (/me)...");
               const response = await HttpService.get("/me");
               
               const responseData = response.data || response;
               let userFormatted = null;

               if (responseData && responseData.data && responseData.data.attributes) {
                   userFormatted = { id: responseData.data.id, ...responseData.data.attributes };
               } else if (responseData && responseData.attributes) {
                   userFormatted = { id: responseData.id, ...responseData.attributes };
               } else {
                   userFormatted = responseData;
               }
               
               setAuth(dispatch, { token: keycloak.token, user: userFormatted });
               console.log(">>> [APP] Perfil de Usuário Sincronizado.");

             } catch (error) {
               console.error(">>> [APP] Falha ao buscar usuário.", error);
               didFetchProfile.current = false; 
             }
        };
        fetchMe();
    } 
    else if (initialized && !keycloak.authenticated && controller.token) {
        console.log(">>> [APP] Logout detectado. Limpando contexto.");
        logout(dispatch);
        didFetchProfile.current = false;
    }
  }, [initialized, keycloak.authenticated, controller.token, dispatch, keycloak.token]); 

  return null;
};

const KeycloakLoadingGuard = ({ children }) => {
  const { initialized } = useKeycloak();
  if (!initialized) {
    return (
      <Box sx={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={60} color="info" />
      </Box>
    );
  }
  return children;
};

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    direction,
    layout,
    sidenavColor,
    transparentSidenav,
    whiteSidenav,
    darkMode,
    token,
  } = controller;

  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const [isDemo, setIsDemo] = useState(false);

  useEffect(() => {
    setIsDemo(process.env.REACT_APP_IS_DEMO === "true");
  }, []);

  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });
    setRtlCache(cacheRtl);
  }, []);

  const handleOnMouseEnter = () => {
    if (miniSidenav && !onMouseEnter) {
      setMiniSidenav(dispatch, false);
      setOnMouseEnter(true);
    }
  };

  const handleOnMouseLeave = () => {
    if (onMouseEnter) {
      setMiniSidenav(dispatch, true);
      setOnMouseEnter(false);
    }
  };

  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  // 2. HANDLER DE TOKENS (Correção do Bug de 5 min)
  const handleOnTokens = useCallback((tokens) => {
      if (tokens && tokens.token) {
          console.log("🔄 [APP] Token atualizado via Keycloak Provider.");
          
          setupAxios(keycloak);
          axios.defaults.headers.common['Authorization'] = `Bearer ${tokens.token}`;

          if (controller.token !== tokens.token) {
             setAuth(dispatch, { token: tokens.token, user: controller.user });
          }
      }
  }, [dispatch, controller.token, controller.user]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) return getRoutes(route.collapse);
      if (route.route && route.type !== "auth") {
        return (
          <Route
            exact
            path={route.route}
            element={
              <ProtectedRoute isAuthenticated={!!token}>
                {route.component}
              </ProtectedRoute>
            }
            key={route.key}
          />
        );
      }
      return null;
    });

  const keycloakInitOptions = {
    onLoad: 'login-required',
    checkLoginIframe: false, 
    pkceMethod: 'S256',
  };

  const MainContent = (
    <ThemeProvider theme={darkMode ? direction === "rtl" ? themeDarkRTL : themeDark : direction === "rtl" ? themeRTL : theme}>
        <CssBaseline />
        {layout === "dashboard" && (
          <>
            <Sidenav
              color={sidenavColor}
              brand={(transparentSidenav && !darkMode) || whiteSidenav ? brandDark : brandWhite}
              routes={routes}
              onMouseEnter={handleOnMouseEnter}
              onMouseLeave={handleOnMouseLeave}
            />
            <Configurator />
          </>
        )}
        {layout === "vr" && <Configurator />}
        
        <DashboardProvider>
          {token && <ForcePasswordChange />}
          <Routes>
            <Route exact path="user-profile" element={<ProtectedRoute isAuthenticated={!!token}><UserProfile /></ProtectedRoute>} key="user-profile" />
            <Route exact path="user-management" element={<ProtectedRoute isAuthenticated={!!token}><UserManagement /></ProtectedRoute>} key="user-management" />
            <Route exact path="/observabilidade/mapeamento-dados/:id" element={<ProtectedRoute isAuthenticated={!!token}><MapeamentoDados /></ProtectedRoute>} key="mapeamento-dados-id" />
            
            {getRoutes(routes)}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </DashboardProvider>
    </ThemeProvider>
  );

  return (
    <ReactKeycloakProvider 
        authClient={keycloak} 
        initOptions={keycloakInitOptions}
        onTokens={handleOnTokens} 
    >
      <UserProfileSync />
      <KeycloakLoadingGuard>
         {direction === "rtl" ? (
             <CacheProvider value={rtlCache}>
                {MainContent}
             </CacheProvider>
         ) : (
             // CORREÇÃO AQUI: Removidas as chaves {} ao redor de MainContent
             MainContent
         )}
      </KeycloakLoadingGuard>
    </ReactKeycloakProvider>
  );
}