import express from "express";
import passport from "passport";
import { PrismaClient, Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const router = express.Router();

// --- Funções Auxiliares ---
// Adapta a resposta para ficar mais limpa, transformando 'assignments' em uma lista de 'resources'
const formatAccountResponse = (account) => {
    if (!account) return null;
    
    let formatted = { ...account };

    // Achata a estrutura de assignments para retornar uma lista simples de recursos/perfis
    if (account.assignments) {
        const profileList = account.assignments.map(a => a.resource).filter(r => !!r);
        formatted.profiles = profileList; // Mantém compatibilidade com o nome 'profiles' que você usava
        delete formatted.assignments;
    }
    return formatted;
};

// --- Funções de Rota ---

/**
 * @route   GET /accounts
 * @desc    Busca contas. Suporta filtros: ?identityId=1 & ?systemId=2 & ?includeProfiles=true
 * @access  Private
 */
const getAccounts = async (req, res) => {
    const { identityId, systemId, includeProfiles } = req.query;
    const whereClause = {};

    // Filtro por Identidade (RH)
    if (identityId) {
        const identityIdInt = parseInt(identityId, 10);
        if (!isNaN(identityIdInt)) {
            whereClause.identityId = identityIdInt;
        } else {
            return res.status(400).json({ message: "Parâmetro 'identityId' inválido." });
        }
    }

    // Filtro por Sistema
    if (systemId) {
        const systemIdInt = parseInt(systemId, 10);
        if (!isNaN(systemIdInt)) {
            whereClause.systemId = systemIdInt;
        } else {
            return res.status(400).json({ message: "Parâmetro 'systemId' inválido." });
        }
    }

    // Configura os Includes (Joins)
    const includeClause = {
        identity: { 
            select: { id: true, name_hr: true, email_hr: true, cpf_hr: true } // Campos do schema atual
        },
        system: { 
            select: { id: true, name_system: true, description_system: true } // Campos do schema atual
        }
    };

    // Se pedir perfis, inclui os assignments e os resources
    if (includeProfiles === 'true') {
        includeClause.assignments = {
            include: {
                resource: { 
                    select: { id: true, name_resource: true, description_resource: true } 
                }
            }
        };
    }

    try {
        const accounts = await prisma.accounts.findMany({
            where: whereClause,
            include: includeClause,
            orderBy: [
                { name_account: 'asc' },       // Ordena por Nome
                { id_in_system_account: 'asc' } // Desempate por Login
            ]
        });

        // Formata para remover a camada 'assignment' e entregar 'profiles' direto
        const formattedAccounts = accounts.map(formatAccountResponse);
        return res.status(200).json(formattedAccounts);

    } catch (error) {
        console.error("Erro ao buscar contas:", error);
        return res.status(500).json({ message: "Erro interno do servidor ao buscar contas." });
    }
};

/**
 * @route   GET /accounts/:id
 * @desc    Busca uma conta específica pelo seu ID.
 * @access  Private
 */
const getAccountById = async (req, res) => {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
        return res.status(400).json({ message: "ID de conta inválido." });
    }

    try {
        const account = await prisma.accounts.findUnique({
            where: { id: accountId },
            include: {
                identity: { select: { id: true, name_hr: true, email_hr: true, cpf_hr: true } },
                system: { select: { id: true, name_system: true } },
                assignments: {
                    include: {
                         resource: { select: { id: true, name_resource: true } }
                    }
                }
            }
        });

        if (!account) {
            return res.status(404).json({ message: "Conta não encontrada." });
        }

        const formattedAccount = formatAccountResponse(account);
        return res.status(200).json(formattedAccount);

    } catch (error) {
        console.error(`Erro ao buscar conta #${accountId}:`, error);
        return res.status(500).json({ message: "Erro interno do servidor." });
    }
};

/**
 * @route   PATCH /accounts/:id
 * @desc    Atualiza dados de uma conta e seus recursos (perfis).
 * @access  Private
 */
const updateAccount = async (req, res) => {
    const accountId = parseInt(req.params.id, 10);
    // Mapeando nomes do body para nomes do schema
    const { name, email, status, userType, extraData, profileIds } = req.body;

    if (isNaN(accountId)) {
        return res.status(400).json({ message: "ID de conta inválido." });
    }

    const dataToUpdate = {};
    if (name !== undefined) dataToUpdate.name_account = name;
    if (email !== undefined) dataToUpdate.email_account = email;
    if (status !== undefined) dataToUpdate.status_account = status;
    if (userType !== undefined) dataToUpdate.user_type_account = userType;
    if (extraData !== undefined) dataToUpdate.extra_data_account = extraData;

    if (Object.keys(dataToUpdate).length === 0 && profileIds === undefined) {
         return res.status(400).json({ message: "Nenhum dado fornecido para atualização." });
    }

     if (profileIds !== undefined && !Array.isArray(profileIds)) {
         return res.status(400).json({ message: "profileIds deve ser um array de IDs de Recursos." });
     }
     const resourceIdsInt = profileIds?.map(id => parseInt(id, 10)).filter(id => !isNaN(id));


    try {
        const updatedAccount = await prisma.$transaction(async (tx) => {
            let account;
            
            // 1. Atualiza dados básicos da conta
            if (Object.keys(dataToUpdate).length > 0) {
                 account = await tx.accounts.update({
                    where: { id: accountId },
                    data: dataToUpdate,
                });
             } else {
                 // Apenas verifica se existe
                 account = await tx.accounts.findUnique({ where: { id: accountId } });
             }

            if (!account) {
                 throw new Error("Conta não encontrada.");
             }

            // 2. Atualiza Vínculos de Recursos (Assignments)
            if (resourceIdsInt !== undefined) {
                // Remove todos os vínculos atuais
                await tx.assignment.deleteMany({
                    where: { accountId: accountId }
                });

                // Cria os novos vínculos
                if (resourceIdsInt.length > 0) {
                    const newAssignments = resourceIdsInt.map(resId => ({
                        accountId: accountId,
                        resourceId: resId,
                    }));
                    
                    await tx.assignment.createMany({
                        data: newAssignments,
                        skipDuplicates: true
                    });
                }
            }

            // 3. Retorna objeto completo
            return await tx.accounts.findUnique({
                 where: { id: accountId },
                 include: {
                     identity: { select: { id: true, name_hr: true } },
                     system: { select: { id: true, name_system: true } },
                     assignments: {
                         include: { resource: { select: { id: true, name_resource: true } } }
                     }
                 }
             });
        });

        if (!updatedAccount) {
           return res.status(404).json({ message: "Conta não encontrada após atualização." });
        }

        const formattedAccount = formatAccountResponse(updatedAccount);
        return res.status(200).json(formattedAccount);

    } catch (error) {
        console.error(`Erro ao atualizar conta #${accountId}:`, error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
              return res.status(409).json({ message: `Erro de unicidade: ${error.meta?.target}` });
         }
         if (error.message === "Conta não encontrada.") {
             return res.status(404).json({ message: error.message });
         }
        return res.status(500).json({ message: "Erro interno do servidor ao atualizar conta." });
    }
};

/**
 * @route   DELETE /accounts/:id
 * @desc    Deleta uma conta específica pelo seu ID.
 * @access  Private
 */
const deleteAccount = async (req, res) => {
    const accountId = parseInt(req.params.id, 10);
    if (isNaN(accountId)) {
        return res.status(400).json({ message: "ID de conta inválido." });
    }

    try {
        // O Cascade no schema garante que Assignments sejam deletados juntos
        const deleteResult = await prisma.accounts.deleteMany({
            where: { id: accountId }
        });

        if (deleteResult.count === 0) {
            return res.status(404).json({ message: "Conta não encontrada." });
        }

        return res.status(204).send();

    } catch (error) {
        console.error(`Erro ao deletar conta #${accountId}:`, error);
         if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
            return res.status(409).json({ message: "Não é possível excluir esta conta pois ela está sendo referenciada em outro lugar." });
        }
        return res.status(500).json({ message: "Erro interno do servidor ao deletar conta." });
    }
};


// --- Rota DELETE em massa por systemId ---
/**
 * @route   DELETE /accounts
 * @desc    Deleta TODAS as contas de um sistema específico.
 * @access  Private
 * @query   ?systemId=<ID> (Obrigatório)
 */
const deleteAccountsBySystem = async (req, res) => {
    const { systemId } = req.query;
    const systemIdInt = parseInt(systemId, 10);

    if (isNaN(systemIdInt)) {
        return res.status(400).json({ message: "Parâmetro 'systemId' é obrigatório e deve ser um número." });
    }

    try {
        // Deleta todas as contas associadas ao systemId
        // O cascade delete no schema cuida de Assignment e AccountDivergenceException
        const deleteResult = await prisma.accounts.deleteMany({
            where: {
                systemId: systemIdInt
            }
        });

        console.log(`Contas deletadas para systemId ${systemIdInt}: ${deleteResult.count}`);

        return res.status(200).json({ message: `${deleteResult.count} contas do sistema foram excluídas.` });

    } catch (error) {
        console.error(`Erro ao deletar contas para o sistema ${systemIdInt}:`, error);
        return res.status(500).json({ message: "Erro interno do servidor ao limpar contas." });
    }
};


// --- Definição das Rotas ---
router.get( "/", passport.authenticate("jwt", { session: false }), getAccounts );
router.delete( "/", passport.authenticate("jwt", { session: false }), deleteAccountsBySystem );
router.get( "/:id", passport.authenticate("jwt", { session: false }), getAccountById );
router.patch( "/:id", passport.authenticate("jwt", { session: false }), updateAccount );
router.delete( "/:id", passport.authenticate("jwt", { session: false }), deleteAccount );

export default router;