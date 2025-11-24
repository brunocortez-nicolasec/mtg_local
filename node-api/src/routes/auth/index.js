import express from "express";
import {
  forgotPasswordRouteHandler,
  loginRouteHandler,
  registerRouteHandler,
  resetPasswordRouteHandler,
} from "../../services/auth";

const router = express.Router();

// 1. Login (Frontend chama /login)
router.post("/login", loginRouteHandler);

// 2. Logout (Frontend chama /auth/logout)
// Mantemos o prefixo aqui pois vimos no erro anterior que o front exige
router.post("/auth/logout", (req, res) => {
  return res.sendStatus(204);
});

// 3. Register (Frontend chama /register)
// CORREÇÃO: Removido o prefixo "/auth"
router.post("/register", async (req, res) => {
  if (!req.body.data || !req.body.data.attributes) {
      return res.status(400).send("Estrutura de dados inválida.");
  }
  const { name, email, password } = req.body.data.attributes;
  await registerRouteHandler(req, res, name, email, password);
});

// 4. Password Forgot (Frontend provavelmente chama /password-forgot)
// CORREÇÃO: Removido o prefixo "/auth" preventivamente
router.post("/password-forgot", async (req, res) => {
  if (!req.body.data || !req.body.data.attributes) {
      return res.status(400).send("Estrutura de dados inválida.");
  }
  const { email } = req.body.data.attributes;
  await forgotPasswordRouteHandler(req, res, email);
});

// 5. Password Reset (Frontend provavelmente chama /password-reset)
// CORREÇÃO: Removido o prefixo "/auth" preventivamente
router.post("/password-reset", async (req, res) => {
  await resetPasswordRouteHandler(req, res);
});

export default router;