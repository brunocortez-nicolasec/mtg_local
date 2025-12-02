// node-api/src/services/livefeed/index.js

import express from "express";
import passport from "passport";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Funções auxiliares
const cleanText = (text) => text?.trim().toLowerCase();
const cleanCpf = (cpf) => cpf?.replace(/[^\d]/g, '');

const getLiveFeedData = async (req, res) => {
    // --- ALTERAÇÃO 1: Receber os filtros da query string ---
    const { system, userType, status, divergenceType } = req.query; 
    const isGeneral = !system || system.toLowerCase() === 'geral';

    const userIdInt = parseInt(req.user.id, 10);
    if (isNaN(userIdInt)) {
        return res.status(400).json({ message: "ID de usuário inválido." });
    }

    try {
      // Usamos uma transação para garantir que os dados sejam consistentes
      const combinedData = await prisma.$transaction(async (tx) => {

        // --- 1. Buscar Identidades (RH) e criar Mapa ---
        const rhIdentities = await tx.identitiesHR.findMany({
            where: { 
                dataSource: { 
                    userId: userIdInt,
                    origem_datasource: 'RH'
                }
            },
        });
        
        const rhMapById = new Map(rhIdentities.map(i => [i.id, i]));

        // --- 1.5. Buscar Exceções ---
        const accountExceptions = await tx.accountDivergenceException.findMany({
            where: { userId: userIdInt },
            select: { accountId: true, divergenceCode: true }
        });
        const accountExceptionsSet = new Set(
            accountExceptions.map(ex => `${ex.accountId}_${ex.divergenceCode}`)
        );

        const identityExceptions = await tx.identityDivergenceException.findMany({
            where: { userId: userIdInt, divergenceCode: 'ACCESS_NOT_GRANTED' },
            select: { identityId: true, targetSystem: true }
        });
        const identityExceptionsSet = new Set(
            identityExceptions.map(ex => `${ex.identityId}_ACCESS_NOT_GRANTED_${ex.targetSystem}`)
        );

        // --- 2. Buscar Contas (Accounts) dos Sistemas ---
        const whereAccounts = {
            system: {
                dataSourcesConfigs: { some: { dataSource: { userId: userIdInt } } }
            }
        };
        
        let targetSystemName = system;
        let systemRecord = null; // Declarado aqui

        if (!isGeneral) {
            if (system.toUpperCase() === 'RH') {
                // Se for RH, não busca contas
            } else {
                systemRecord = await tx.system.findUnique({
                    where: { name_system: system }, 
                    select: { id: true }
                });
                if (!systemRecord) {
                    console.warn(`LiveFeed: Sistema ${system} não encontrado.`);
                    throw new Error(`Sistema "${system}" não encontrado.`);
                }
                whereAccounts.system.name_system = system; // Filtra as contas por nome
            }
        }
        
        let systemAccounts = [];
        
        if (!system || system.toUpperCase() !== 'RH') { 
            systemAccounts = await tx.accounts.findMany({
                where: whereAccounts, 
                include: {
                    identity: true, 
                    system: { select: { id: true, name_system: true } },
                    assignments: { 
                        include: {
                            resource: true 
                        }
                    }
                },
            });
        }
        
        // Se a métrica for específica para o RH, formatamos as identidades
        if (system && system.toUpperCase() === 'RH') {
             systemAccounts = rhIdentities.map(id => ({
                id: id.id,
                id_in_system_account: id.identity_id_hr,
                name_account: id.name_hr,
                email_account: id.email_hr,
                cpf_account: id.cpf_hr,
                status_account: id.status_hr,
                user_type_account: id.user_type_hr,
                extra_data_account: id.extra_data_hr,
                identityId: id.id,
                systemId: null,
                system: { name_system: 'RH', id: null },
                identity: id, 
                assignments: [], 
             }));
        }
        
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        // --- 4. Processar Contas (Órfãs, Zumbis, Mismatch, Dormentes) ---
        const finalData = systemAccounts.map(account => {
            
            if (account.system.name_system.toUpperCase() === 'RH') {
                 const isAdmin = (account.user_type_account || '').toLowerCase().includes('admin');
                 return {
                    id: account.id,
                    identityId: account.identityId,
                    name: account.name_account,
                    email: account.email_account,
                    userType: account.user_type_account,
                    perfil: 'N/A (Fonte Autoritativa)', 
                    rh_status: account.status_account || 'N/A',
                    app_status: 'N/A',
                    sourceSystem: account.system.name_system,
                    divergence: false, 
                    isCritical: isAdmin, 
                    divergenceDetails: [],
                    id_user: account.id_in_system_account,
                    cpf: account.identity?.cpf_hr, 
                    last_login: account.extra_data_account?.last_login || null,
                    rhData: account.identity, 
                 };
            }

            const rhUser = account.identity;
            const divergenceDetails = [];
            
            const perfilString = account.assignments.map(a => a.resource?.name_resource).filter(Boolean).join(', ') || 'N/A';
            
            const isAdmin = perfilString.toLowerCase().includes('admin');
            const isOrphan = !rhUser; 

            if (isOrphan) {
                if (!accountExceptionsSet.has(`${account.id}_ORPHAN_ACCOUNT`)) {
                    const code = 'ORPHAN_ACCOUNT';
                    const text = 'Conta Órfã: Não foi possível vincular a uma identidade do RH (identityId está nulo).';
                    divergenceDetails.push({ 
                        code: code, 
                        text: text,
                        rhData: null,
                        appData: account
                    });
                }
            }

            if(rhUser) { 
                const isZombie = account.status_account === 'Ativo' && rhUser.status_hr === 'Inativo';
                if (isZombie) {
                    if (!accountExceptionsSet.has(`${account.id}_ZOMBIE_ACCOUNT`)) {
                        divergenceDetails.push({ code: 'ZOMBIE_ACCOUNT', text: 'Acesso Ativo Indevido: Conta ativa, mas identidade inativa no RH.', rhData: rhUser, appData: account });
                    }
                }
                
                const hasNameDivergence = account.name_account && rhUser.name_hr && cleanText(account.name_account) !== cleanText(rhUser.name_hr);
                if (hasNameDivergence) {
                    if (!accountExceptionsSet.has(`${account.id}_NAME_MISMATCH`)) {
                        divergenceDetails.push({ code: 'NAME_MISMATCH', text: 'Divergência de Nome.', rhData: rhUser, appData: account });
                    }
                }
                
                const hasEmailDivergence = account.email_account && rhUser.email_hr && cleanText(account.email_account) !== cleanText(rhUser.email_hr);
                if (hasEmailDivergence) {
                    if (!accountExceptionsSet.has(`${account.id}_EMAIL_MISMATCH`)) {
                        divergenceDetails.push({ code: 'EMAIL_MISMATCH', text: 'Divergência de E-mail.', rhData: rhUser, appData: account });
                    }
                }

                const hasCpfDivergence = account.cpf_account && rhUser.cpf_hr && cleanCpf(account.cpf_account) !== cleanCpf(rhUser.cpf_hr);
                if (hasCpfDivergence) {
                    if (!accountExceptionsSet.has(`${account.id}_CPF_MISMATCH`)) {
                         divergenceDetails.push({ code: 'CPF_MISMATCH', text: 'Divergência de CPF.', rhData: rhUser, appData: account });
                    }
                }
            }

            let hasAnyDivergence = divergenceDetails.length > 0;
            
            const loginDateStr = typeof account.extra_data_account === 'object' && account.extra_data_account !== null ? account.extra_data_account.last_login : null;
            const loginDate = loginDateStr ? new Date(loginDateStr) : null;
            const isDormant = loginDate && !isNaN(loginDate.getTime()) && loginDate < ninetyDaysAgo;
            const isAdminDormente = isAdmin && account.status_account === 'Ativo' && isDormant;
            
            if (isAdminDormente) {
                if (!accountExceptionsSet.has(`${account.id}_DORMANT_ADMIN`)) {
                    divergenceDetails.push({ 
                        code: 'DORMANT_ADMIN', 
                        text: 'Conta de Administrador Dormente (sem login há mais de 90 dias).',
                        rhData: rhUser,
                        appData: account
                    });
                    hasAnyDivergence = true; 
                }
            }
            
            const isCritical = hasAnyDivergence && isAdmin;
            
            return {
                id: account.id, 
                identityId: account.identityId,
                name: account.name_account,
                email: account.email_account,
                cpf_account: account.cpf_account,
                userType: rhUser?.user_type_hr || 'N/A', 
                perfil: perfilString,
                rh_status: rhUser?.status_hr || (isOrphan ? 'Não encontrado' : 'N/A'),
                app_status: account.status_account || 'N/A', 
                sourceSystem: account.system.name_system,
                divergence: hasAnyDivergence,
                isCritical: isCritical,
                divergenceDetails: divergenceDetails,
                id_user: account.id_in_system_account,
                cpf: rhUser?.cpf_hr || null, 
                last_login: loginDateStr,
                rhData: rhUser || null,
            };
        });
        
        // --- Etapa 5: (ACCESS_NOT_GRANTED) ---
        const missingAccessUsers = [];
        const activeRhIdentities = rhIdentities.filter(rhId => rhId.status_hr === 'Ativo');

        const createMissingUserEntry = (rhUser, missingSystem) => {
            const divergenceDetails = [{ 
                code: 'ACCESS_NOT_GRANTED', 
                text: `Acesso Previsto Não Concedido: Usuário ativo no RH, mas sem conta em ${missingSystem}.`,
                rhData: rhUser,
                appData: null,
                targetSystem: missingSystem
            }];
            
            const isAdmin = (rhUser.user_type_hr || '').toLowerCase().includes('admin');
            const isCritical = isAdmin; 

            return {
                id: `${rhUser.id}-${missingSystem}`, 
                identityId: rhUser.id,
                name: rhUser.name_hr,
                email: rhUser.email_hr,
                userType: rhUser.user_type_hr,
                perfil: 'N/A', 
                rh_status: rhUser.status_hr,
                app_status: 'Não encontrado',
                sourceSystem: missingSystem, 
                divergence: true, 
                isCritical: isCritical, 
                divergenceDetails: divergenceDetails,
                id_user: rhUser.identity_id_hr,
                cpf: rhUser.cpf_hr,
                last_login: null,
                rhData: rhUser, 
            };
        };
        
        const identitySystemMap = systemAccounts.reduce((map, acc) => {
            if (!acc.identityId) return map; 
            if (!map.has(acc.identityId)) {
                map.set(acc.identityId, new Set());
            }
            map.get(acc.identityId).add(acc.systemId);
            return map;
        }, new Map());

        if (isGeneral) {
            const allAppSystems = await tx.system.findMany({ 
                where: { 
                    dataSourcesConfigs: { some: { dataSource: { userId: userIdInt } } },
                    name_system: { not: 'RH' } 
                }, 
                select: { id: true, name_system: true } 
            }); 
            
            for (const sys of allAppSystems) {
                 activeRhIdentities.forEach(rhUser => {
                     const hasAccountInSystem = identitySystemMap.get(rhUser.id)?.has(sys.id);
                      if (!hasAccountInSystem) { 
                        const isExcepted = identityExceptionsSet.has(`${rhUser.id}_ACCESS_NOT_GRANTED_${sys.name_system}`);
                        if (!isExcepted) {
                            missingAccessUsers.push(createMissingUserEntry(rhUser, sys.name_system));
                        }
                      }
                 });
            }
        } else if (systemRecord) {
             activeRhIdentities.forEach(rhUser => {
                const hasAccountInSystem = identitySystemMap.get(rhUser.id)?.has(systemRecord.id);
                 if (!hasAccountInSystem) { 
                    const isExcepted = identityExceptionsSet.has(`${rhUser.id}_ACCESS_NOT_GRANTED_${system}`);
                    if (!isExcepted) {
                        missingAccessUsers.push(createMissingUserEntry(rhUser, system));
                    }
                 }
             });
        }
        
        // --- Etapa 6: Combinar e Filtrar ---
        // ALTERAÇÃO 2: Usar 'let' para permitir reatribuição durante filtragem
        let combinedResult = [...finalData, ...missingAccessUsers];

        // --- ALTERAÇÃO 3: Aplicação dos Filtros ---
        
        // 1. Filtro por Tipo de Usuário (userType)
        if (userType) {
            if (userType === 'Não categorizado') {
                // Procura por nulo, indefinido ou string vazia
                combinedResult = combinedResult.filter(item => !item.userType || item.userType.trim() === '');
            } else {
                // Procura pelo valor exato (case insensitive)
                combinedResult = combinedResult.filter(item => item.userType && item.userType.toLowerCase() === userType.toLowerCase());
            }
        }

        // 2. Filtro por Status (rh_status ou app_status)
        if (status) {
            combinedResult = combinedResult.filter(item => 
                (item.rh_status && item.rh_status.toLowerCase() === status.toLowerCase()) ||
                (item.app_status && item.app_status.toLowerCase() === status.toLowerCase())
            );
        }

        // 3. Filtro por Tipo de Divergência
        if (divergenceType) {
            combinedResult = combinedResult.filter(item => 
                item.divergenceDetails.some(d => d.code === divergenceType)
            );
        }
        
        return combinedResult;

      }); // Fim da transação
      
      return res.status(200).json(combinedData);

    } catch (error) {
        console.error(`Erro Live Feed:`, error);
        return res.status(500).json({ message: "Erro interno." });
    }
};

// Define a rota GET para o Live Feed
router.get(
    "/",
    passport.authenticate("jwt", { session: false }),
    getLiveFeedData
);

export default router;