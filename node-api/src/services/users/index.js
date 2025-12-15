import express from "express";
import passport from "passport";
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

// --- IMPORTAÇÃO DOS SERVIÇOS DO KEYCLOAK ---
import { 
  createUserInKeycloak, 
  deleteUserInKeycloak, 
  updateUserInKeycloak 
} from "../keycloakService/index.js"; 

const prisma = new PrismaClient();
const router = express.Router();

// Middleware para verificar se é Admin
const isAdmin = (req, res, next) => {
  if (req.user && req.user.profile?.name === 'Admin') { 
    next();
  } else {
    res.status(403).json({ message: "Acesso negado. Apenas administradores." });
  }
};

// Função para gerar senha forte aleatória
const generateTemporaryPassword = (length = 12) => {
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const special = "!@#$%^&*(),.?\":{}|<>";
    const all = lower + upper + numbers + special;

    let password = "";
    password += lower.charAt(Math.floor(Math.random() * lower.length));
    password += upper.charAt(Math.floor(Math.random() * upper.length));
    password += numbers.charAt(Math.floor(Math.random() * numbers.length));
    password += special.charAt(Math.floor(Math.random() * special.length));

    for (let i = password.length; i < length; i++) {
        password += all.charAt(Math.floor(Math.random() * all.length));
    }

    return password.split('').sort(() => 0.5 - Math.random()).join('');
};

// --- LISTAR USUÁRIOS (GET) ---
router.get(
  "/",
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const users = await prisma.user.findMany({
        include: { profile: true, package: true }, 
        orderBy: { createdAt: 'desc' }
      });
      res.status(200).json(users);
    } catch (error) {
      console.error("List Users Error:", error);
      res.status(500).json({ message: "Erro ao buscar usuários." });
    }
  }
);

// --- CRIAR USUÁRIO (POST) ---
router.post(
  "/",
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const { name, email, password, role, packageId } = req.body; 
      
      const profileObject = await prisma.profile.findUnique({ where: { name: role } });
      if (!profileObject) {
        return res.status(400).json({ message: `O perfil '${role}' não é válido.` });
      }

      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        return res.status(409).json({ message: "Este email já está em uso no Portal." });
      }

      // Validação de senha
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>])(?=.{8,})/;
      if (!passwordRegex.test(password)) {
          return res.status(400).json({ 
              message: "A senha deve ter no mínimo 8 caracteres, uma letra maiúscula, uma minúscula, um número e um caractere especial." 
          });
      }

      // 1. CRIAÇÃO NO KEYCLOAK
      console.log(`[Users] Criando ${email} no Keycloak...`);
      try {
          await createUserInKeycloak({ name, email, password });
      } catch (kcError) {
          console.error("Erro Keycloak Create:", kcError);
          return res.status(500).json({ 
              message: "Erro ao criar usuário no provedor de identidade (Keycloak).", 
              details: kcError.message 
          });
      }

      // 2. CRIAÇÃO NO BANCO LOCAL
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const newUser = await prisma.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          profileId: profileObject.id, 
          packageId: packageId || null,
          mustChangePassword: false 
        },
        include: { profile: true, package: true }, 
      });

      res.status(201).json(newUser);
    } catch (error) {
      console.error("Create User Error:", error);
      res.status(500).json({ message: "Erro ao criar o usuário no banco local." });
    }
  }
);

// --- RESET DE SENHA PELO ADMIN (POST) ---
router.post(
    "/:id/reset-password",
    passport.authenticate("jwt", { session: false }),
    isAdmin,
    async (req, res) => {
      try {
        const userId = parseInt(req.params.id, 10);
        if (isNaN(userId)) return res.status(400).json({ message: "ID inválido." });
  
        const userToReset = await prisma.user.findUnique({ where: { id: userId } });
        if (!userToReset) return res.status(404).json({ message: "Usuário não encontrado." });

        // 1. Gera senha
        const tempPassword = generateTemporaryPassword(12);
        
        // 2. Reseta no Keycloak
        try {
            await updateUserInKeycloak(userToReset.email, { password: tempPassword });
        } catch (kcError) {
            console.error("Erro Keycloak Reset:", kcError);
            return res.status(500).json({ message: "Falha ao resetar senha no Keycloak.", details: kcError.message });
        }

        // 3. Reseta no Banco Local (Backup)
        const hashedPassword = await bcrypt.hash(tempPassword, 10);
  
        await prisma.user.update({
          where: { id: userId },
          data: { password: hashedPassword, mustChangePassword: true } // mustChangePassword é visual no portal
        });
  
        res.status(200).json({ 
            message: "Senha resetada com sucesso (Local e Keycloak).",
            tempPassword: tempPassword 
        });
  
      } catch (error) {
        console.error("Reset Password Error:", error);
        res.status(500).json({ message: "Erro ao resetar a senha." });
      }
    }
);

// --- TROCA DE SENHA PELO PRÓPRIO USUÁRIO (POST) ---
// Nota: Com Keycloak, idealmente o usuário troca no painel do Keycloak, mas mantemos para funcionar a tela de perfil.
router.post(
  "/change-password",
  passport.authenticate("jwt", { session: false }),
  async (req, res) => {
    // Redireciona o usuário ou avisa que deve ser feito via Keycloak se preferir.
    // Mas se quiser permitir via Portal, precisamos implementar a chamada de API.
    // Devido à complexidade de segurança (o usuário precisaria reautenticar),
    // a melhor prática aqui é retornar uma mensagem instruindo o uso do fluxo do Keycloak ou Admin.
    
    // Se quiser permitir, use updateUserInKeycloak passando o email do req.user
    // Por enquanto, manteremos apenas a mensagem para evitar quebra de fluxo de token.
    return res.status(400).json({ message: "Por favor, utilize a função de 'Esqueci minha senha' na tela de login ou peça ao administrador." });
  }
);

// --- EDITAR USUÁRIO (PATCH) ---
router.patch(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  (req, res, next) => {
      const targetId = parseInt(req.params.id, 10);
      if (req.user.profile?.name === 'Admin' || req.user.id === targetId) {
          next();
      } else {
          res.status(403).json({ message: "Sem permissão." });
      }
  },
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      const { name, email, role, packageId, password } = req.body; 
      
      const currentUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!currentUser) return res.status(404).json({ message: "Usuário não encontrado." });

      // 1. ATUALIZA NO KEYCLOAK (Se mudou dados críticos)
      if (name || email || password) {
          try {
              await updateUserInKeycloak(currentUser.email, { name, email, password });
          } catch (kcError) {
              return res.status(500).json({ message: "Erro ao atualizar dados no Keycloak.", details: kcError.message });
          }
      }

      // 2. ATUALIZA NO BANCO LOCAL
      const dataToUpdate = { name, email };
      
      if (password && password.trim() !== "") {
          dataToUpdate.password = await bcrypt.hash(password, 10);
          dataToUpdate.mustChangePassword = false; 
      }
      
      // Lógica de Permissão para Roles/Packages (Só Admin pode mudar)
      if (req.user.profile?.name === 'Admin') {
          if (role) {
            const roleNameToFind = typeof role === 'string' ? role : role.name;
            const profileObject = await prisma.profile.findUnique({ where: { name: roleNameToFind } });
            if (!profileObject) return res.status(400).json({ message: "Perfil inválido." });
            dataToUpdate.profileId = profileObject.id; 
          }
          if (packageId !== undefined) {
            dataToUpdate.packageId = packageId === "" ? null : packageId;
          }
      }
      
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: dataToUpdate,
        include: { profile: true, package: true }, 
      });
      
      res.status(200).json(updatedUser);
    } catch (error) {
      console.error("Update User Error:", error);
      res.status(500).json({ message: "Erro ao atualizar." });
    }
  }
);

// --- DELETAR USUÁRIO (DELETE) ---
router.delete(
  "/:id",
  passport.authenticate("jwt", { session: false }),
  isAdmin,
  async (req, res) => {
    try {
      const userId = parseInt(req.params.id, 10);
      if (isNaN(userId)) return res.status(400).json({ message: "ID inválido." });
      if (req.user.id === userId) return res.status(400).json({ message: "Não pode deletar a si mesmo." });
      
      const userToDelete = await prisma.user.findUnique({ where: { id: userId } });
      
      if (userToDelete) {
          // 1. DELETA NO KEYCLOAK
          await deleteUserInKeycloak(userToDelete.email);
          
          // 2. DELETA NO BANCO LOCAL
          await prisma.user.delete({ where: { id: userId } });
      }
      
      res.status(200).json({ message: "Usuário deletado (Local e Keycloak)." });
    } catch (error) {
      console.error("Delete User Error:", error);
      res.status(500).json({ message: "Erro ao deletar." });
    }
  }
);

export default router;