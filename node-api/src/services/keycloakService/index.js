import KcAdminClient from '@keycloak/keycloak-admin-client';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  baseUrl: process.env.KEYCLOAK_URL,
  realmName: process.env.KEYCLOAK_REALM,
};

const kcAdminClient = new KcAdminClient(config);

// Autentica o cliente (Helper interno)
const authKeycloak = async () => {
    await kcAdminClient.auth({
      grantType: 'client_credentials',
      clientId: process.env.KEYCLOAK_CLIENT_ID,
      clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
    });
};

export const createUserInKeycloak = async (userData) => {
  try {
    await authKeycloak();
    const newUser = {
      username: userData.email,
      email: userData.email,
      firstName: userData.name,
      lastName: "", 
      emailVerified: true,
      enabled: true,
      credentials: [{ type: 'password', value: userData.password, temporary: false }],
    };
    const createdUser = await kcAdminClient.users.create(newUser);
    return createdUser;
  } catch (error) {
    if (error.response && error.response.status === 409) return null;
    throw new Error("Erro Keycloak Create: " + (error.response?.data?.errorMessage || error.message));
  }
};

// --- NOVAS FUNÇÕES ---

export const deleteUserInKeycloak = async (email) => {
    try {
        await authKeycloak();
        // 1. Busca o ID do usuário no Keycloak pelo e-mail
        const users = await kcAdminClient.users.find({ email: email, exact: true });
        
        if (users.length > 0) {
            const userIdKw = users[0].id;
            // 2. Deleta pelo ID
            await kcAdminClient.users.del({ id: userIdKw });
            console.log(`[Keycloak] Usuário ${email} deletado.`);
        } else {
            console.warn(`[Keycloak] Usuário ${email} não encontrado para deleção.`);
        }
    } catch (error) {
        console.error("Erro Keycloak Delete:", error);
        // Não lançamos erro para não impedir a deleção local caso o KC falhe
    }
};

export const updateUserInKeycloak = async (originalEmail, dataToUpdate) => {
    try {
        await authKeycloak();
        const users = await kcAdminClient.users.find({ email: originalEmail, exact: true });
        
        if (users.length > 0) {
            const userIdKw = users[0].id;
            const updatePayload = {};

            if (dataToUpdate.name) updatePayload.firstName = dataToUpdate.name;
            if (dataToUpdate.email) {
                updatePayload.email = dataToUpdate.email;
                updatePayload.username = dataToUpdate.email; // Mantém username = email
                updatePayload.emailVerified = true;
            }
            // Se precisar atualizar senha
            if (dataToUpdate.password) {
                 await kcAdminClient.users.resetPassword({
                    id: userIdKw,
                    credential: { type: 'password', value: dataToUpdate.password, temporary: false }
                 });
            }

            // Atualiza dados cadastrais
            if (Object.keys(updatePayload).length > 0) {
                await kcAdminClient.users.update({ id: userIdKw }, updatePayload);
            }
            console.log(`[Keycloak] Usuário ${originalEmail} atualizado.`);
        }
    } catch (error) {
        console.error("Erro Keycloak Update:", error);
        throw new Error("Falha ao atualizar no Keycloak: " + error.message);
    }
};