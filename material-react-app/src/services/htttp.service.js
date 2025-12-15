//material-react-app/src/services/htttp.service.js

import axios from "axios";

const API_URL = process.env.REACT_APP_API_URL;

// --- Instância Local ---
const axiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
  },
});

// --- Variáveis de Controle (Escopo do Módulo) ---
let isRefreshing = false;
let failedQueue = [];
let currentKeycloakInstance = null; // <--- TRAVA DE SEGURANÇA

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// --- FUNÇÃO DE SETUP (Chamada no App.js) ---
export const setupAxios = (keycloak) => {
  // 1. TRAVA DE SEGURANÇA: Se já configuramos este Keycloak, não faça nada.
  // Isso impede que o loop do React destrua a performance.
  if (currentKeycloakInstance === keycloak) {
      return; 
  }
  
  currentKeycloakInstance = keycloak;
  console.log("🔧 [HttpService] Configurando interceptadores (Execução Única)...");

  // Função auxiliar de injeção de token
  const injectToken = (config) => {
    if (keycloak && keycloak.token) {
      config.headers.Authorization = `Bearer ${keycloak.token}`;
    }
    return config;
  };

  // Função auxiliar de tratamento de erro (401)
  const handleAuthError = async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers["Authorization"] = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      console.log("🔒 [HttpService] 401 Detectado. Renovando token...");

      return new Promise(async (resolve, reject) => {
        try {
          // Tenta renovar o token (se < 5s ou expirado)
          const refreshed = await keycloak.updateToken(5);
          
          if (refreshed) {
            console.log("✅ [HttpService] Token renovado!");
          }

          const newToken = keycloak.token;
          
          // Atualiza headers padrão
          axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
          axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;

          processQueue(null, newToken);

          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          // Usa a instância local para o retry
          resolve(axiosInstance(originalRequest));

        } catch (refreshError) {
          console.error("❌ [HttpService] Falha ao renovar:", refreshError);
          processQueue(refreshError, null);
          reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      });
    }
    return Promise.reject(error);
  };

  // 2. Aplica interceptadores na Instância Local
  // Removemos anteriores limpando o array de handlers (hack seguro do axios) se necessário,
  // mas como temos a trava 'currentKeycloakInstance', isso não é mais crítico.
  axiosInstance.interceptors.request.use(injectToken, Promise.reject);
  axiosInstance.interceptors.response.use((r) => r, handleAuthError);

  // 3. Aplica interceptadores na Instância Global (axios)
  axios.interceptors.request.use(injectToken, Promise.reject);
  axios.interceptors.response.use((r) => r, handleAuthError);
  
  console.log("🛡️ [HttpService] Blindagem aplicada.");
};

export default axiosInstance;