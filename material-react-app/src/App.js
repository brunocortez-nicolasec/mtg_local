// material-react-app/src/App.js

import { useState, useEffect, useMemo } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
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
import { useMaterialUIController, setMiniSidenav, setOpenConfigurator, logout } from "context";
import { DashboardProvider } from "context/DashboardContext";
// ======================= INÍCIO DA ALTERAÇÃO =======================
import brandWhite from "assets/images/mtg_icon_branco.png"; // Ícone para Sidenav escura/padrão
import brandDark from "assets/images/mtg_icon_azul.png";   // Ícone para Sidenav clara
// ======================== FIM DA ALTERAÇÃO =========================
import { setupAxiosInterceptors } from "./services/interceptor";
import ProtectedRoute from "examples/ProtectedRoute";
import ForgotPassword from "auth/forgot-password";
import ResetPassword from "auth/reset-password";
import Login from "auth/login";
import Register from "auth/register";
import UserProfile from "layouts/user-profile";
import UserManagement from "layouts/user-management";

// --- INÍCIO DA ADIÇÃO ---
// 1. Importar o novo componente de mapeamento
import MapeamentoDados from "layouts/observabilidade/mapeamentoDados";
// --- FIM DA ADIÇÃO ---

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    direction,
    layout,
    openConfigurator,
    sidenavColor,
    transparentSidenav,
    whiteSidenav,
    darkMode,
    token,
  } = controller;

  const [onMouseEnter, setOnMouseEnter] = useState(false);
  const [rtlCache, setRtlCache] = useState(null);
  const { pathname } = useLocation();
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

  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);

  const navigate = useNavigate();

  setupAxiosInterceptors(() => {
    logout(dispatch);
    navigate("/auth/login");
  });

  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;
  }, [pathname]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) {
        return getRoutes(route.collapse);
      }
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

  return direction === "rtl" ? (
    <CacheProvider value={rtlCache}>
      {/* ... */}
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {layout === "dashboard" && (
        <>
          <Sidenav
            color={sidenavColor}
            brand={(transparentSidenav && !darkMode) || whiteSidenav ? brandDark : brandWhite}
            routes={routes}
          />
          <Configurator />
        </>
      )}
      {layout === "vr" && <Configurator />}
      <DashboardProvider>
        <Routes>
          <Route path="/auth/login" element={<Login />} />
          <Route path="/auth/register" element={<Register />} />
          <Route path="/auth/forgot-password" element={<ForgotPassword />} />
          <Route path="/auth/reset-password" element={<ResetPassword />} />
          <Route
            exact
            path="user-profile"
            element={
              <ProtectedRoute isAuthenticated={!!token}>
                <UserProfile />
              </ProtectedRoute>
            }
            key="user-profile"
          />
          <Route
            exact
            path="user-management"
            element={
              <ProtectedRoute isAuthenticated={!!token}>
                <UserManagement />
              </ProtectedRoute>
            }
            key="user-management"
          />

          {/* --- INÍCIO DA ADIÇÃO --- */}
          {/* 2. Adicionar a rota com o parâmetro :id */}
          <Route
            exact
            path="/observabilidade/mapeamento-dados/:id"
            element={
              <ProtectedRoute isAuthenticated={!!token}>
                <MapeamentoDados />
              </ProtectedRoute>
            }
            key="mapeamento-dados-id"
          />
          {/* --- FIM DA ADIÇÃO --- */}

          {getRoutes(routes)}
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </Routes>
      </DashboardProvider>
    </ThemeProvider>
  );
}