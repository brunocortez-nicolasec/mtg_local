// material-react-app/src/setupProxy.js

const { createProxyMiddleware } = require("http-proxy-middleware");

const apiRoutes = [
  "/auth",
  "/me",
  "/users",
  "/roles",
  "/groups",
  "/platforms",
  "/packages",
  "/imports",
  "/conjur",
  "/metrics",
  "/identities",
  "/divergences",
  "/live-feed",
  "/systems",
  "/sod-rules",
  "/profiles",
  "/identity-attributes",
  "/rbac-rules",
  "/accounts",
  "/datasources",
  "/systems-catalog",
  "/resources",
  "/exports",
];

// Configuração do proxy com a função onProxyReq
const proxyConfig = {
  target: process.env.REACT_APP_API_URL,
  changeOrigin: true,
  onProxyReq: (proxyReq, req, res) => {
    if (req.headers.authorization) {
      proxyReq.setHeader("Authorization", req.headers.authorization);
    }
  },
};

module.exports = function (app) {
  // Aplica o proxy para cada rota da API individualmente
  apiRoutes.forEach((route) => {
    app.use(route, createProxyMiddleware(proxyConfig));
  });
};