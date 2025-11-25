import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import "./passport.js";
import { meRoutes, authRoutes } from "./routes";
import usersRoutes from "./services/users/index.js";
import rolesRoutes from "./services/roles/index.js";
import groupsRoutes from "./services/groups/index.js";
import platformsRoutes from "./services/platforms/index.js";
import packagesRoutes from "./services/packages/index.js";
import importsRoutes from "./services/imports/index.js";
import metricsRoutes from "./services/metrics/index.js";
import identitiesRoutes from "./services/identities/index.js";
import divergencesRoutes from "./services/divergences/index.js";
import livefeedRoutes from "./services/livefeed/index.js";
import systemsRoutes from "./services/systems/index.js";
import sodRoutes from "./services/sod/index.js";
import profilesRoutes from "./services/profiles/index.js";
import attributesRoutes from "./services/attributes/index.js";
import rbacRoutes from "./services/rbac/index.js";
import accountsRoutes from "./services/accounts/index.js";
import systemsCatalogRoutes from "./services/systems-catalog/index.js";
import resourcesRoutes from "./services/resources/index.js";
import exportsRoutes from "./services/exports/index.js";

import passport from "passport"; 
import { testCsvConnection } from "./services/datasources/testCsv.js";
import { testDbConnection } from "./services/datasources/testDb.js"; 

import path from "path";
import * as fs from "fs";

// 1. Carrega as variáveis do arquivo .env
dotenv.config();

const PORT = process.env.PORT || 8080;
const app = express();

// 2. Lê estritamente do ambiente. Sem fallbacks hardcoded.
const CLIENT_URL = process.env.APP_URL_CLIENT;
const API_URL = process.env.API_PUBLIC_URL;
const HOSTNAME_URL = process.env.API_HOSTNAME_URL;

// Verificação de segurança na inicialização
if (!CLIENT_URL || !API_URL) {
  console.error("❌ ERRO CRÍTICO: Variáveis de ambiente APP_URL_CLIENT ou API_PUBLIC_URL não definidas.");
  console.error("Verifique o arquivo .env no diretório node-api.");
  // Em produção, você poderia dar um process.exit(1) aqui.
} else {
  console.log("✅ Configuração de Ambiente Carregada:");
  console.log(`   Client: ${CLIENT_URL}`);
  console.log(`   API: ${API_URL}`);
}

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = [
      CLIENT_URL,
      API_URL,
      HOSTNAME_URL,
      `${CLIENT_URL}/`, // Garante que a barra no final também seja aceita
      `${HOSTNAME_URL}/`, // Garante que a barra no final também seja aceita
      `${API_URL}/`
    ];

    // Permite requisições sem 'origin' (como Postman) ou se a origem estiver na lista permitida pelo .env
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.error(`🚫 Bloqueado pelo CORS. Origem: ${origin}`);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS",
  allowedHeaders: "Content-Type, Authorization, Accept",
};

app.use(cors(corsOptions));

app.use(express.json());

app.get("/", function (req, res) {
  const __dirname = fs.realpathSync(".");
  res.sendFile(path.join(__dirname, "/src/landing/index.html"));
});

// Rotas
app.use("/", authRoutes);
app.use("/me", meRoutes);
app.use("/users", usersRoutes);
app.use("/roles", rolesRoutes);
app.use("/groups", groupsRoutes);
app.use("/platforms", platformsRoutes);
app.use("/packages", packagesRoutes);
app.use("/imports", importsRoutes);
app.use("/metrics", metricsRoutes);
app.use("/identities", identitiesRoutes);
app.use("/divergences", divergencesRoutes);
app.use("/live-feed", livefeedRoutes);
app.use("/systems", systemsRoutes);
app.use("/sod-rules", sodRoutes);
app.use("/profiles", profilesRoutes);
app.use("/identity-attributes", attributesRoutes);
app.use("/rbac-rules", rbacRoutes);
app.use("/accounts", accountsRoutes);
app.use("/systems-catalog", systemsCatalogRoutes);
app.use("/resources", resourcesRoutes);
app.use("/exports", exportsRoutes);

app.post(
  "/datasources/test-csv",
  passport.authenticate("jwt", { session: false }),
  testCsvConnection
);
app.post(
  "/datasources/test-db",
  passport.authenticate("jwt", { session: false }),
  testDbConnection
);

app.listen(PORT, () => console.log(`Server listening to port ${PORT}`));