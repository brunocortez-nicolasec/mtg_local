// node-api/src/services/metrics/index.js

import express from "express";
import passport from "passport";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Função auxiliar para limpar texto
const cleanText = (text) => text?.trim().toLowerCase();

// ======================= INÍCIO DA ADIÇÃO (Clean CPF) =======================
// Adicionado para a nova divergência de CPF
const cleanCpf = (cpf) => cpf?.replace(/[^\d]/g, '');
// ======================== FIM DA ADIÇÃO (Clean CPF) =========================

// Esta função auxiliar AGORA É USADA para SoD
const checkAttributeMatch = (operator, userValue, ruleValue) => {
  if (userValue === null || userValue === undefined || ruleValue === null || ruleValue === undefined) {
    return false;
  }
  const u = String(userValue).toLowerCase();
  const r = String(ruleValue).toLowerCase();
  
  switch (operator) {
    case 'equals':
      return u === r;
    case 'not_equals':
      return u !== r;
    case 'contains':
      return u.includes(r);
    case 'starts_with':
      return u.startsWith(r);
    case 'ends_with':
      return u.endsWith(r);
    default:
      return false;
  }
};

const getSystemMetrics = async (req, res) => {
    const { system } = req.params; // Nome do Sistema (ex: "SAP", "RH", "Geral")
    const isGeneral = system.toLowerCase() === 'geral';

    const userIdInt = parseInt(req.user.id, 10);
    if (isNaN(userIdInt)) {
        return res.status(400).json({ message: "ID de usuário inválido." });
    }

    try {
      // Usaremos uma transação para garantir que os dados sejam consistentes
      const metrics = await prisma.$transaction(async (tx) => {

        // 1. Buscar TODAS as Identidades (RH) do usuário
        const rhIdentities = await tx.identitiesHR.findMany({
            where: { 
                dataSource: { 
                    userId: userIdInt,
                    origem_datasource: 'RH'
                }
            },
        });
        
        const rhMapById = new Map(rhIdentities.map(i => [i.id, i]));

        // 2. Definir o filtro do sistema
        const systemFilter = {};
        let systemRecord = null; 

        if (!isGeneral && system.toUpperCase() !== 'RH') {
            systemRecord = await tx.system.findUnique({
                where: { name_system: system }, 
                select: { id: true }
            });
            
            if (!systemRecord) {
                console.warn(`Sistema ${system} não encontrado para métricas.`);
                throw new Error(`Sistema "${system}" não encontrado.`);
            }
            
            systemFilter.systemId = systemRecord.id;
        }
        
        // 3. Buscar as Contas (Accounts) relevantes
        let allAccounts = [];
        if (system.toUpperCase() !== 'RH') {
            allAccounts = await tx.accounts.findMany({
                where: {
                    system: {
                        dataSourcesConfigs: { some: { dataSource: { userId: userIdInt } } },
                    },
                    ...systemFilter 
                },
                include: {
                    identity: true, 
                    system: { select: { name_system: true, id: true } },
                    assignments: { 
                        include: {
                            resource: true
                        }
                    }
                },
            });
        }

        // Se o usuário selecionou "RH" no filtro, simulamos as identidades como "contas"
        if (system.toUpperCase() === 'RH') {
            allAccounts = rhIdentities.map(id => ({
                id: id.id,
                id_in_system_account: id.identity_id_hr,
                name_account: id.name_hr,
                email_account: id.email_hr,
                cpf_account: id.cpf_hr, // <-- ADICIONADO PARA CONSISTÊNCIA
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
        
        if (!isGeneral && system.toUpperCase() !== 'RH' && allAccounts.length === 0) {
             const zeroMetrics = {
                pills: { total: 0, ativos: 0, inativos: 0, desconhecido: 0 },
                tiposDeUsuario: [],
                kpisAdicionais: { contasDormentes: 0, acessoPrivilegiado: 0, adminsDormentes: 0 },
                divergencias: { inativosRHAtivosApp: 0, cpf: 0, nome: 0, email: 0, acessoPrevistoNaoConcedido: 0, ativosNaoEncontradosRH: 0, sodViolations: 0 }, 
                pamRiscos: { acessosIndevidos: 0 },
                riscos: { prejuizoPotencial: 'R$ 0,00', valorMitigado: 'R$ 0,00', indiceConformidade: 100.0, prejuizoBreakdown: [], riscosEmContasPrivilegiadas: 0, sodViolationCount: 0 }, 
            };
            return zeroMetrics;
        }
        
        // 3.5. Buscar TODAS as exceções relevantes
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

// ======================= INÍCIO DA ADIÇÃO (Buscar Regras SoD) =======================
        // 3.6. Buscar TODAS as Regras de SoD
        const allSodRules = await tx.sodRule.findMany({
            where: { userId: userIdInt }
        });

        // Organiza as regras por sistema para consulta rápida
        const sodRulesBySystem = allSodRules.reduce((acc, rule) => {
            // 'global' para regras com systemId = null
            const key = rule.systemId || 'global'; 
            if (!acc[key]) {
                acc[key] = [];
            }
            acc[key].push(rule);
            return acc;
        }, {});
        const globalSodRules = sodRulesBySystem['global'] || [];
// ======================== FIM DA ADIÇÃO (Buscar Regras SoD) =========================

        // 4. Calcular Métricas de Visão Geral (Pills e Gráfico de Pizza)
        const total = allAccounts.length;
        const active = allAccounts.filter(acc => acc.status_account === 'Ativo').length;
        const inactive = allAccounts.filter(acc => acc.status_account === 'Inativo').length;
        const unknown = total - (active + inactive);

        const byUserType = allAccounts.reduce((acc, account) => {
            const key = account.identity?.user_type_hr || 'Não categorizado';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});

        // 5. Calcular KPIs Adicionais
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        let contasDormentes = 0;
        let adminsDormentes = 0;
        const adminsComDivergencia = new Set();
        const divergentAccountIds = new Set();
        const divergentIdentityIds = new Set();

        const acessoPrivilegiado = allAccounts.filter(acc =>
            acc.status_account === 'Ativo' &&
            acc.assignments.some(a => a.resource.name_resource.toLowerCase().includes('admin'))
        ).length;

        // 6. Calcular Divergências (Loop Principal)
        let inativosRHAtivosAppCount = 0; // Zumbi
        let naoEncontradosRHCount = 0; // Contas Órfãs
        let divergenciaNomeCount = 0;
        let divergenciaEmailCount = 0;
        let divergenciaCpfCount = 0;
        let acessoPrevistoNaoConcedidoCount = 0;
// ======================= INÍCIO DA ADIÇÃO (Contador SoD) =======================
        let sodViolationCount = 0; // <-- ADICIONADO AQUI
// ======================== FIM DA ADIÇÃO (Contador SoD) =========================
        
        for (const account of allAccounts) {
            if (account.system.name_system.toUpperCase() === 'RH') continue;

            const rhEquivalent = account.identity; 
            let hasDivergence = false;
            
            const isAdmin = account.assignments.some(a => a.resource.name_resource.toLowerCase().includes('admin'));
            
            if (rhEquivalent) {
                const { status_hr: rhStatus, name_hr: rhName, email_hr: rhEmail, cpf_hr: rhCpf } = rhEquivalent;
                
                // --- ZUMBI ---
                if (account.status_account === 'Ativo' && rhStatus === 'Inativo') {
                    if (!accountExceptionsSet.has(`${account.id}_ZOMBIE_ACCOUNT`)) {
                        inativosRHAtivosAppCount++;
                        hasDivergence = true;
                    }
                }
                
                // --- NOME ---
                const hasNameDivergence = rhName && account.name_account && cleanText(rhName) !== cleanText(account.name_account);
                if (hasNameDivergence) {
                    if (!accountExceptionsSet.has(`${account.id}_NAME_MISMATCH`)) {
                        divergenciaNomeCount++;
                        hasDivergence = true;
                    }
                }

                // --- EMAIL ---
                const hasEmailDivergence = rhEmail && account.email_account && cleanText(rhEmail) !== cleanText(account.email_account);
                if (hasEmailDivergence) {
                    if (!accountExceptionsSet.has(`${account.id}_EMAIL_MISMATCH`)) {
                        divergenciaEmailCount++;
                        hasDivergence = true;
                    }
                }

                // --- CPF (NOVO) ---
                const hasCpfDivergence = rhCpf && account.cpf_account && cleanCpf(rhCpf) !== cleanCpf(account.cpf_account);
                if (hasCpfDivergence) {
                    if (!accountExceptionsSet.has(`${account.id}_CPF_MISMATCH`)) {
                        divergenciaCpfCount++;
                        hasDivergence = true;
                    }
                }

                // --- ADMIN DORMENTE ---
                const loginDateStr = account.extra_data_account?.last_login;
                if (account.status_account === 'Ativo' && loginDateStr) {
                    const loginDate = new Date(loginDateStr);
                    if (!isNaN(loginDate.getTime()) && loginDate < ninetyDaysAgo) {
                        contasDormentes++;
                        if (isAdmin) {
                            if (!accountExceptionsSet.has(`${account.id}_DORMANT_ADMIN`)) {
                                adminsDormentes++;
                                hasDivergence = true;
                            }
                        }
                    }
                }

            } else {
                // --- CONTA ÓRFÃ ---
                if (!accountExceptionsSet.has(`${account.id}_ORPHAN_ACCOUNT`)) {
                    naoEncontradosRHCount++; 
                    hasDivergence = true;
                }
            }
            
// ======================= INÍCIO DA ADIÇÃO (Lógica de SoD) =======================
            // 8. Verificar Violações de SoD
            
            // Pega as regras globais + regras específicas do sistema desta conta
            const systemRules = sodRulesBySystem[account.systemId] || [];
            const applicableSodRules = [...globalSodRules, ...systemRules];

            if (applicableSodRules.length > 0) {
                // Cria um Set com os IDs dos Recursos (perfis) que a conta possui
                const accountResourceIds = new Set(account.assignments.map(a => a.resource.id));

                for (const rule of applicableSodRules) {
                    let isViolation = false;

                    if (rule.ruleType === 'ROLE_X_ROLE') {
                        // Se a regra é "Perfil vs Perfil"
                        const hasProfileA = accountResourceIds.has(parseInt(rule.valueAId, 10));
                        const hasProfileB = accountResourceIds.has(parseInt(rule.valueBId, 10));
                        if (hasProfileA && hasProfileB) {
                            isViolation = true;
                        }

                    } else if (rule.ruleType === 'ATTR_X_ROLE') {
                        // Se a regra é "Atributo vs Perfil"
                        if (rhEquivalent) { // Só pode checar se a conta tem uma identidade
                            const hasProfileB = accountResourceIds.has(parseInt(rule.valueBId, 10));
                            
                            // Pega o valor do atributo da identidade (ex: 'user_type_hr')
                            const attributeValue = rhEquivalent[rule.valueAId]; 
                            
                            const attributeMatches = checkAttributeMatch(
                                rule.valueAOperator,
                                attributeValue,
                                rule.valueAValue
                            );

                            if (attributeMatches && hasProfileB) {
                                isViolation = true;
                            }
                        }
                    }
                    // (Outros tipos de regra como ATTR_X_SYSTEM não se aplicam a *contas*)

                    if (isViolation) {
                        if (!accountExceptionsSet.has(`${account.id}_SOD_VIOLATION`)) {
                            sodViolationCount++;
                            hasDivergence = true;
                        }
                        // Importante: Quebra o loop de regras assim que a *primeira* violação for encontrada
                        // para não contar a mesma conta múltiplas vezes
                        break; 
                    }
                }
            }
// ======================== FIM DA ADIÇÃO (Lógica de SoD) =========================
            
            if (hasDivergence) {
                divergentAccountIds.add(account.id);
                // Se a conta tem uma identidade e uma divergência, a identidade é divergente
                if (account.identityId) {
                    divergentIdentityIds.add(account.identityId);
                }
            }

            if (isAdmin && hasDivergence) {
                adminsComDivergencia.add(account.id);
            }
        } // Fim do loop for(allAccounts)

        // 7. Calcular Acesso Previsto Não Concedido
        const activeRhIdentities = rhIdentities.filter(rhId => rhId.status_hr === 'Ativo');
        
        const accountsByIdentity = allAccounts.reduce((acc, account) => {
            if (!account.identityId) return acc;
            if (!acc.has(account.identityId)) acc.set(account.identityId, new Set());
            acc.get(account.identityId).add(account.systemId);
            return acc;
        }, new Map());

        const allSystems = await tx.system.findMany({
            where: { 
                dataSourcesConfigs: { some: { dataSource: { userId: userIdInt } } },
                name_system: { not: 'RH' } 
            },
            select: { id: true, name_system: true } 
        });

        for (const sys of allSystems) {
            if (!isGeneral && sys.name_system !== system) continue;
            
            activeRhIdentities.forEach(rhIdentity => {
                const identitySystems = accountsByIdentity.get(rhIdentity.id);
                const hasAccountInSystem = identitySystems ? identitySystems.has(sys.id) : false;
                
                if (!hasAccountInSystem) {
                    if (!identityExceptionsSet.has(`${rhIdentity.id}_ACCESS_NOT_GRANTED_${sys.name_system}`)) {
                        acessoPrevistoNaoConcedidoCount++;
                        divergentIdentityIds.add(rhIdentity.id);
                    }
                }
            });
        }
        
        // 8. Métricas Obsoletas
        // const sodViolationCount = 0; // <-- REMOVIDO DAQUI

        // 9. Calcular Riscos Financeiros
        const CUSTOS_DE_RISCO = {
            CRITICO: 10000,
            PRIVILEGIO: 7500,
            CONFORMIDADE: 3000,
            PRODUTIVIDADE: 1500,
            OPERACIONAL: 500,
            SOD: 8000, 
        };

        const conformidadeCount = divergenciaCpfCount;
        const operacionalCount = divergenciaNomeCount + divergenciaEmailCount;
        const criticoCount = inativosRHAtivosAppCount + naoEncontradosRHCount;

        const prejuizoCalculado = 
            (criticoCount * CUSTOS_DE_RISCO.CRITICO) +
            (adminsComDivergencia.size * CUSTOS_DE_RISCO.PRIVILEGIO) +
            (conformidadeCount * CUSTOS_DE_RISCO.CONFORMIDADE) +
            (acessoPrevistoNaoConcedidoCount * CUSTOS_DE_RISCO.PRODUTIVIDADE) +
            (operacionalCount * CUSTOS_DE_RISCO.OPERACIONAL) +
            (sodViolationCount * CUSTOS_DE_RISCO.SOD); 

        const valorMitigado = prejuizoCalculado * 0.95;
        
        // Lógica do Índice de Conformidade (baseada em Identidades)
        const totalPopulation = rhIdentities.length; 
        const totalDivergentIdentities = divergentIdentityIds.size; 
        

        const calculatedIndex = totalPopulation > 0 
            ? ((totalPopulation - totalDivergentIdentities) / totalPopulation) * 100 
            : 100;
        const indiceConformidade = calculatedIndex.toFixed(1);
        
        const prejuizoBreakdown = [
            { label: "Risco Crítico (Contas Órfãs e Zumbis)", count: criticoCount, costPerUnit: CUSTOS_DE_RISCO.CRITICO, subTotal: criticoCount * CUSTOS_DE_RISCO.CRITICO },
            { label: "Risco Elevado (Privilégio)", count: adminsComDivergencia.size, costPerUnit: CUSTOS_DE_RISCO.PRIVILEGIO, subTotal: adminsComDivergencia.size * CUSTOS_DE_RISCO.PRIVILEGIO },
            { label: "Risco de Segregação de Função (SoD)", count: sodViolationCount, costPerUnit: CUSTOS_DE_RISCO.SOD, subTotal: sodViolationCount * CUSTOS_DE_RISCO.SOD }, 
            { label: "Risco de Conformidade (CPF)", count: conformidadeCount, costPerUnit: CUSTOS_DE_RISCO.CONFORMIDADE, subTotal: conformidadeCount * CUSTOS_DE_RISCO.CONFORMIDADE },
            { label: "Risco de Produtividade (Acesso Não Concedido)", count: acessoPrevistoNaoConcedidoCount, costPerUnit: CUSTOS_DE_RISCO.PRODUTIVIDADE, subTotal: acessoPrevistoNaoConcedidoCount * CUSTOS_DE_RISCO.PRODUTIVIDADE },
            { label: "Risco Operacional (Nome, E-mail)", count: operacionalCount, costPerUnit: CUSTOS_DE_RISCO.OPERACIONAL, subTotal: operacionalCount * CUSTOS_DE_RISCO.OPERACIONAL },
        ];
        
        // 10. Montar o objeto de retorno
        const finalMetrics = {
            pills: { total, ativos: active, inativos: inactive, desconhecido: unknown },
            tiposDeUsuario: Object.entries(byUserType).map(([tipo, total]) => ({ tipo, total })).sort((a, b) => b.total - a.total),
            kpisAdicionais: { contasDormentes, acessoPrivilegiado, adminsDormentes },
            divergencias: {
                inativosRHAtivosApp: inativosRHAtivosAppCount,
                cpf: divergenciaCpfCount,
                nome: divergenciaNomeCount,
                email: divergenciaEmailCount,
                acessoPrevistoNaoConcedido: acessoPrevistoNaoConcedidoCount,
                ativosNaoEncontradosRH: naoEncontradosRHCount,
                sodViolations: sodViolationCount,
            },
            pamRiscos: { acessosIndevidos: 0 },
            riscos: {
                prejuizoPotencial: `R$ ${prejuizoCalculado.toLocaleString('pt-BR')}`,
                valorMitigado: `R$ ${valorMitigado.toLocaleString('pt-BR')}`,
                indiceConformidade: parseFloat(indiceConformidade),
                prejuizoBreakdown: prejuizoBreakdown.filter(b => b.count > 0),
                riscosEmContasPrivilegiadas: adminsComDivergencia.size,
                sodViolationCount: sodViolationCount,
            },
        };
        
        return finalMetrics;
      }); // Fim da transação

      return res.status(200).json(metrics);

    } catch (error) {
        console.error(`Erro ao calcular métricas para o sistema ${system}:`, error);
        return res.status(500).json({ message: error.message || "Erro interno do servidor ao calcular métricas." });
    }
};

router.get(
    "/:system",
    passport.authenticate("jwt", { session: false }),
    getSystemMetrics
);

export default router;