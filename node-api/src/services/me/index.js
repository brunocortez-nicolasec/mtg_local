import bcrypt from "bcrypt";
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
dotenv.config();

export const getProfileRouteHandler = async (req, res) => {
  try {
    const userId = req.user.id;

    // Busca o usuário e inclui profile, package E GROUPS
    const foundUser = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true, 
        groups: true, // <--- ADICIONADO: Buscar grupos
        package: {
          include: {
            platforms: true,
          },
        },
      },
    });

    if (!foundUser) {
      return res.status(404).json({ message: "Usuário não encontrado." });
    }

    const sentData = {
      data: {
        type: 'users',
        id: foundUser.id,
        attributes: {
          name: foundUser.name,
          email: foundUser.email,
          profile_image: foundUser.profile_image,
          role: foundUser.profile ? foundUser.profile.name : "Sem perfil",
          package: foundUser.package ? foundUser.package.name : "Nenhum", // Apenas o nome basta para exibir
          
          // --- NOVA LISTA ---
          groups: foundUser.groups.map(g => g.name), 
          // ------------------

          mustChangePassword: foundUser.mustChangePassword, 
          createdAt: foundUser.createdAt,
          updatedAt: foundUser.updatedAt
        }
      }
    }
    res.send(sentData);
  } catch (error) {
    console.error("Get Profile Error:", error);
    return res.status(500).json({ message: "Um erro inesperado ocorreu ao buscar o perfil." });
  }
};

export const patchProfileRouteHandler = async (req, res) => {
  // ... (MANTIDO IGUAL AO ANTERIOR) ...
  try {
    const currentUser = req.user;
    const { newPassword, confirmPassword, profile_image } = req.body.data.attributes;
    
    const dataToUpdate = {};

    // Nome e Email removidos da atualização, pois são readonly no front agora
    if (profile_image) dataToUpdate.profile_image = profile_image;

    if (newPassword) {
      if (newPassword.length < 8 || newPassword !== confirmPassword) {
        return res.status(400).json({ message: "As senhas devem ter no mínimo 8 caracteres e ser iguais." });
      }
      
      const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*(),.?":{}|<>])(?=.{8,})/;
      if (!passwordRegex.test(newPassword)) {
          return res.status(400).json({ 
              message: "A senha deve ter no mínimo 8 caracteres, maiúscula, minúscula, número e caractere especial." 
          });
      }

      const salt = await bcrypt.genSalt(10);
      dataToUpdate.password = await bcrypt.hash(newPassword, salt);
      dataToUpdate.mustChangePassword = false; 
    }
    
    await prisma.user.update({
      where: { id: currentUser.id },
      data: dataToUpdate,
    });
    
    res.status(200).json({ message: "Perfil atualizado com sucesso." });

  } catch (error) {
    console.error("Update Profile Error:", error);
    return res.status(500).json({ message: "Um erro inesperado aconteceu durante a atualização do perfil." });
  }
};