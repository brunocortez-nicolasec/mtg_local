import express from "express";
import passport from "passport";
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

// Helper para validar os dados básicos da DataSource
const validateDataSource = (data) => {
  const { name_datasource, origem_datasource, type_datasource } = data;
  if (!name_datasource) return "O nome da fonte de dados é obrigatório.";
  if (!origem_datasource || !["RH", "IDM", "SISTEMA"].includes(origem_datasource)) {
    return "A 'Origem' (RH, IDM, SISTEMA) é obrigatória e deve ser um valor válido.";
  }
  // Validação do 'type_datasource' é tratada de forma diferente para SISTEMA agora
  if (origem_datasource !== "SISTEMA" && !type_datasource) {
    return "O 'Tipo de Fonte' (CSV, API, DATABASE) é obrigatório.";
  }
  
  return null; // Sem erros
};

/**
 * @route   GET /systems
 * @desc    Busca todas as DataSources do usuário logado
 * @access  Private
 */
const getDataSources = async (req, res) => {
  const userIdInt = parseInt(req.user.id, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }

  try {
    const dataSources = await prisma.dataSource.findMany({
      where: { userId: userIdInt },
      orderBy: { createdAt: 'desc' },
      include: {
        hrConfig: true,
        idmConfig: true,
        systemConfig: {
          include: {
            system: true 
          }
        },
        mappingRH: true,
        mappingIDM: true,
        mappingSystem: true,
      },
    });
    
    res.status(200).json(dataSources);

  } catch (error) {
    console.error("Erro ao buscar DataSources:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * @route   GET /systems/:id
 * @desc    Busca UMA DataSource específica por ID
 * @access  Private
 */
const getDataSourceById = async (req, res) => {
  const dataSourceId = parseInt(req.params.id, 10);
  if (isNaN(dataSourceId)) {
    return res.status(400).json({ message: "ID de Fonte de Dados inválido." });
  }

  const userIdInt = parseInt(req.user.id, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }

  try {
    const dataSource = await prisma.dataSource.findFirst({
      where: { 
        id: dataSourceId, 
        userId: userIdInt 
      },
      include: {
        hrConfig: true,
        idmConfig: true,
        systemConfig: {
          include: {
            system: true
          }
        },
        mappingRH: true,
        mappingIDM: true,
        mappingSystem: true,
      },
    });

    if (!dataSource) {
      return res.status(404).json({ message: "Fonte de dados não encontrada." });
    }

    res.status(200).json(dataSource);

  } catch (error) {
    console.error("Erro ao buscar DataSource por ID:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * @route   POST /systems
 * @desc    Cria uma nova DataSource e sua configuração específica (RH, IDM ou SystemConfig)
 * @access  Private
 */
const createDataSource = async (req, res) => {
  
  // Extraindo todos os campos do body (incluindo DB, CSV e API)
  const { 
    name, origem, databaseType, description, 
    diretorio, // Campo do RH
    systemId, 
    tipo_fonte_contas, diretorio_contas, 
    tipo_fonte_recursos, diretorio_recursos,
    // Campos DB:
    db_connection_type, db_host, db_port, db_name, db_user, db_password, db_type, db_url, db_schema, db_table,
    // Campos CSV:
    csv_delimiter, csv_quote,
    // Campos API (NOVO):
    api_url, api_method, api_headers, api_body, api_response_path
  } = req.body;

  const data = {
    name_datasource: name,
    origem_datasource: origem?.toUpperCase(),
    type_datasource: origem?.toUpperCase() === 'SISTEMA' ? (databaseType || 'CSV') : databaseType, // Fallback para manter o ENUM
    description_datasource: description,
  };

  const validationError = validateDataSource(data);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const userIdInt = parseInt(req.user.id, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }

  try {
    const existingDataSource = await prisma.dataSource.findFirst({
      where: { name_datasource: { equals: data.name_datasource, mode: 'insensitive' }, userId: userIdInt },
    });

    if (existingDataSource) {
      return res.status(409).json({ message: `A fonte de dados "${data.name_datasource}" já existe.` });
    }

    if (data.origem_datasource === "SISTEMA") {
      // Nota: systemId pode ser nulo agora, pois criaremos se não existir
      if (!tipo_fonte_contas || !["CSV", "DATABASE", "API"].includes(tipo_fonte_contas)) {
          return res.status(400).json({ message: "O 'Tipo de Fonte (Contas)' é obrigatório (CSV, DATABASE, ou API)." });
      }
      if (!tipo_fonte_recursos || !["CSV", "DATABASE", "API"].includes(tipo_fonte_recursos)) {
          return res.status(400).json({ message: "O 'Tipo de Fonte (Recursos)' é obrigatório (CSV, DATABASE, ou API)." });
      }
    }


    const newDataSource = await prisma.$transaction(async (tx) => {
      
      const dataSource = await tx.dataSource.create({
        data: {
          ...data,
          userId: userIdInt,
        },
      });

      // Objeto de configuração de DB reutilizável
      const dbConfig = {
        db_connection_type: db_connection_type || 'HOST',
        db_host, db_port, db_name, db_user, db_password, 
        db_type: db_type || 'postgres',
        db_url, db_schema, db_table
      };
      
      // Objeto de configuração de CSV reutilizável
      const csvConfig = {
          csv_delimiter: csv_delimiter || ",",
          csv_quote: csv_quote || '"'
      };

      // Objeto de configuração de API reutilizável (NOVO)
      const apiConfig = {
          api_url, 
          api_method: api_method || 'GET', 
          api_headers, 
          api_body, 
          api_response_path
      };

      switch (data.origem_datasource) {
        case "RH":
          await tx.hRConfig.create({
            data: {
              dataSourceId: dataSource.id,
              diretorio_hr: diretorio, 
              ...dbConfig,
              ...csvConfig,
              ...apiConfig // Salva config API
            }
          });
          break;
          
        case "IDM":
          await tx.iDMConfig.create({
            data: {
              dataSourceId: dataSource.id,
              api_url: "http://exemplo.com/api", // Placeholder
              api_user: "user", // Placeholder
            }
          });
          break;
          
        case "SISTEMA": {
          // Lógica de criação Atômica do Sistema no Catálogo
          let finalSystemId = systemId ? parseInt(systemId, 10) : null;
          
          if (!finalSystemId) {
              // Verifica se já existe por nome para evitar duplicidade
              const existingSys = await tx.system.findUnique({ where: { name_system: data.name_datasource } });
              if (existingSys) {
                  finalSystemId = existingSys.id;
              } else {
                  const newSys = await tx.system.create({
                      data: {
                          name_system: data.name_datasource,
                          description_system: data.description_datasource
                      }
                  });
                  finalSystemId = newSys.id;
              }
          }

          await tx.systemConfig.create({
            data: {
              dataSourceId: dataSource.id,
              systemId: finalSystemId, 
              tipo_fonte_contas: tipo_fonte_contas,
              diretorio_contas: diretorio_contas, 
              tipo_fonte_recursos: tipo_fonte_recursos,
              diretorio_recursos: diretorio_recursos,
              ...dbConfig,
              ...csvConfig,
              ...apiConfig // Salva config API
            }
          });
          break;
        }
          
        default:
          throw new Error("Origem de DataSource inválida.");
      }
      
      // Retorna o dataSource + o config (para modo de edição futura)
      const finalDS = await tx.dataSource.findUnique({
        where: { id: dataSource.id },
        include: { systemConfig: true, hrConfig: true }
      });
      
      return finalDS; 
    });

    res.status(201).json(newDataSource);

  } catch (error) {
     if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          return res.status(409).json({ message: `O nome "${data.name_datasource}" já está em uso.` });
        }
        if (error.message.includes("Argument `tipo_fonte_contas` is missing")) {
           return res.status(400).json({ message: "O Tipo de Fonte (Contas) é obrigatório." });
        }
     }
    console.error("Erro ao criar DataSource:", error);
    res.status(500).json({ message: error.message || "Erro interno do servidor." });
  }
};

/**
 * @route   PATCH /systems/:id
 * @desc    Atualiza uma DataSource e sua configuração específica
 * @access  Private
 */
const updateDataSource = async (req, res) => {
  const dataSourceId = parseInt(req.params.id, 10);
  if (isNaN(dataSourceId)) {
    return res.status(400).json({ message: "ID de Fonte de Dados inválido." });
  }

  const { 
    name, origem, databaseType, description, 
    diretorio, 
    systemId, 
    tipo_fonte_contas, diretorio_contas, 
    tipo_fonte_recursos, diretorio_recursos,
    // Campos DB
    db_connection_type, db_host, db_port, db_name, db_user, db_password, db_type, db_url, db_schema, db_table,
    // Campos CSV
    csv_delimiter, csv_quote,
    // Campos API (NOVO)
    api_url, api_method, api_headers, api_body, api_response_path
  } = req.body;

  const data = {
    name_datasource: name,
    origem_datasource: origem?.toUpperCase(),
    type_datasource: origem?.toUpperCase() === 'SISTEMA' ? (databaseType || 'CSV') : databaseType,
    description_datasource: description,
  };

  const validationError = validateDataSource(data);
  if (validationError) {
    return res.status(400).json({ message: validationError });
  }

  const userIdInt = parseInt(req.user.id, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }

  try {
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId: userIdInt },
    });

    if (!dataSource) {
      return res.status(404).json({ message: "Fonte de dados não encontrada." });
    }
    
    if (data.origem_datasource === "SISTEMA") {
      if (!systemId) {
        return res.status(400).json({ message: "O 'Sistema de Destino' (systemId) é obrigatório." });
      }
      if (!tipo_fonte_contas) {
         return res.status(400).json({ message: "O 'Tipo de Fonte (Contas)' é obrigatório." });
      }
      if (!tipo_fonte_recursos) {
         return res.status(400).json({ message: "O 'Tipo de Fonte (Recursos)' é obrigatório." });
      }
    }

    const updatedDataSource = await prisma.$transaction(async (tx) => {
      
      const updatedDS = await tx.dataSource.update({
        where: { id: dataSourceId },
        data: data,
      });

      const dbConfig = {
        db_connection_type: db_connection_type || 'HOST',
        db_host, db_port, db_name, db_user, db_password, 
        db_type: db_type || 'postgres', db_url, db_schema, db_table
      };

      const csvConfig = {
          csv_delimiter: csv_delimiter || ",",
          csv_quote: csv_quote || '"'
      };

      // Configuração API (NOVO)
      const apiConfig = {
          api_url, 
          api_method: api_method || 'GET', 
          api_headers, 
          api_body, 
          api_response_path
      };

      switch (data.origem_datasource) {
        case "RH":
          await tx.hRConfig.upsert({
            where: { dataSourceId: dataSourceId },
            update: { 
                diretorio_hr: diretorio,
                ...dbConfig,
                ...csvConfig,
                ...apiConfig // Atualiza API
            },
            create: { 
                dataSourceId: dataSourceId, 
                diretorio_hr: diretorio,
                ...dbConfig,
                ...csvConfig,
                ...apiConfig // Salva API
            }
          });
          break;
        case "IDM":
          // (Lógica para atualizar IDMConfig)
          break;
        case "SISTEMA":
          await tx.systemConfig.upsert({
            where: { dataSourceId: dataSourceId },
            update: {
              systemId: parseInt(systemId, 10),
              tipo_fonte_contas: tipo_fonte_contas,
              diretorio_contas: diretorio_contas,     
              tipo_fonte_recursos: tipo_fonte_recursos,
              diretorio_recursos: diretorio_recursos,
              ...dbConfig,
              ...csvConfig,
              ...apiConfig // Atualiza API
            },
            create: {
              dataSourceId: dataSourceId,
              systemId: parseInt(systemId, 10),
              tipo_fonte_contas: tipo_fonte_contas,
              diretorio_contas: diretorio_contas,     
              tipo_fonte_recursos: tipo_fonte_recursos,
              diretorio_recursos: diretorio_recursos,
              ...dbConfig,
              ...csvConfig,
              ...apiConfig // Salva API
            }
          });
          break;
      }
      
      const finalDS = await tx.dataSource.findUnique({
        where: { id: dataSource.id },
        include: { systemConfig: true, hrConfig: true }
      });
      
      return finalDS; 
    });

    res.status(200).json(updatedDataSource);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
       return res.status(409).json({ message: `O nome "${data.name_datasource}" já está em uso.` });
    }
    console.error("Erro ao atualizar DataSource:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};


/**
 * @route   DELETE /systems/:id
 * @desc    Deleta uma DataSource (e suas configs via cascade)
 * @access  Private
 */
const deleteDataSource = async (req, res) => {
  const dataSourceId = parseInt(req.params.id, 10);
  if (isNaN(dataSourceId)) {
    return res.status(400).json({ message: "ID de Fonte de Dados inválido." });
  }

  const userIdInt = parseInt(req.user.id, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }
  
  try {
    // 1. Busca a Fonte de Dados E o SystemConfig associado (se houver)
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId: userIdInt },
      include: {
        systemConfig: true // Inclui o config para pegar o systemId
      }
    });

    if (!dataSource) {
      return res.status(404).json({ message: "Fonte de dados não encontrada." });
    }
    
    let systemIdToClean = null;
    if (dataSource.origem_datasource === "SISTEMA" && dataSource.systemConfig) {
      systemIdToClean = dataSource.systemConfig.systemId;
    }

    // 2. Deleta o DataSource (em transação ou não, mas é mais seguro assim)
    await prisma.$transaction(async (tx) => {
      
      // A cascata do schema (onDelete: Cascade) cuidará de deletar:
      // - HRConfig, IDMConfig, SystemConfig
      // - DataMappingRH, DataMappingIDM, DataMappingSystem
      // - IdentitiesHR (para RH), IdentitiesIDM (para IDM)
      // - ImportLog
      await tx.dataSource.delete({
        where: { id: dataSourceId },
      });

      // 3. Limpeza Pós-Exclusão (Apenas para SISTEMA)
      if (systemIdToClean) {
        // 4. Verifica se algum *outro* SystemConfig ainda aponta para este System
        const remainingConfigs = await tx.systemConfig.count({
          where: { systemId: systemIdToClean }
        });

        // 5. Se não houver mais configs, deleta o 'System' (Catálogo)
        // A cascata do 'System' cuidará de limpar:
        // - Accounts, Resource, Assignment
        if (remainingConfigs === 0) {
          await tx.system.delete({
            where: { id: systemIdToClean }
          });
        }
      }
    });

    res.status(204).send();
    
  } catch (error) {
    console.error("Erro ao deletar DataSource:", error);
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
       return res.status(409).json({ message: "Não é possível excluir esta fonte, pois ela ainda está sendo referenciada (ex: em logs de importação)." });
    }
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * @route   POST /systems/:id/mapping
 * @desc    Salva (substituindo) o mapeamento de colunas para uma DataSource
 * @access  Private
 */
const saveOrUpdateMapping = async (req, res) => {
  const dataSourceId = parseInt(req.params.id, 10);
  const mappingData = req.body; 
  const userIdInt = parseInt(req.user.id, 10);

  if (isNaN(dataSourceId)) {
    return res.status(400).json({ message: "ID de Fonte de Dados inválido." });
  }
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }
  if (typeof mappingData !== 'object' || Array.isArray(mappingData)) {
    return res.status(400).json({ message: "Formato de mapeamento inválido. Esperava um objeto." });
  }

  try {
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId: userIdInt },
    });
    if (!dataSource) {
      return res.status(404).json({ message: "Fonte de dados não encontrada." });
    }

    switch (dataSource.origem_datasource) {
      case "RH":
        await prisma.dataMappingRH.upsert({
          where: { dataSourceId: dataSource.id }, 
          create: { dataSourceId: dataSource.id, ...mappingData },
          update: { ...mappingData }
        });
        break;
      case "IDM":
        await prisma.dataMappingIDM.upsert({
          where: { dataSourceId: dataSource.id }, 
          create: { dataSourceId: dataSource.id, ...mappingData },
          update: { ...mappingData }
        });
        break;
      case "SISTEMA":
        await prisma.dataMappingSystem.upsert({
          where: { dataSourceId: dataSource.id }, 
          create: { dataSourceId: dataSource.id, ...mappingData },
          update: { ...mappingData }
        });
        break;
      default:
        throw new Error("Origem de DataSource inválida para mapeamento.");
    }

    res.status(200).json({ message: "Mapeamento salvo com sucesso." });

  } catch (error) {
    console.error("Erro ao salvar mapeamento:", error);
    res.status(500).json({ message: "Erro interno do servidor ao salvar mapeamento." });
  }
};

// --- FUNÇÕES ATUALIZADAS PARA O NOVO SCHEMA ---

/**
 * @route   GET /systems/:id/data
 * @desc    Busca os dados processados (IdentitiesHR, Accounts, etc.) para uma DataSource
 * @access  Private
 */
const getSystemData = async (req, res) => {
  const dataSourceId = parseInt(req.params.id, 10);
  const userIdInt = parseInt(req.user.id, 10);

  if (isNaN(dataSourceId) || isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID inválido." });
  }

  try {
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId: userIdInt },
    });
    if (!dataSource) {
      return res.status(404).json({ message: "Fonte de dados não encontrada." });
    }

    let data = [];
    switch (dataSource.origem_datasource) {
      case "RH":
        data = await prisma.identitiesHR.findMany({
          where: { dataSourceId: dataSourceId }
        });
        break;
      case "IDM":
        data = await prisma.identitiesIDM.findMany({
          where: { dataSourceId: dataSourceId }
        });
        break;
      case "SISTEMA":
        data = await prisma.accounts.findMany({
          where: {
            system: {
              dataSourcesConfigs: {
                some: {
                  dataSourceId: dataSourceId
                }
              }
            }
          },
          include: {
            identity: { 
              select: { name_hr: true, identity_id_hr: true }
            }, 
            system: { 
              select: { name_system: true }
            },    
          }
        }); 
        break;
      default:
        throw new Error("Origem de dados desconhecida.");
    }
    
    res.status(200).json(data);

  } catch (error) {
    console.error("Erro ao buscar dados processados:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * @route   DELETE /systems/:id/data
 * @desc    Limpa os dados processados (IdentitiesHR, Accounts, etc.) de uma DataSource
 * @access  Private
 */
const clearSystemData = async (req, res) => {
  const dataSourceId = parseInt(req.params.id, 10);
  const userIdInt = parseInt(req.user.id, 10);

  if (isNaN(dataSourceId) || isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID inválido." });
  }

  try {
    const dataSource = await prisma.dataSource.findFirst({
      where: { id: dataSourceId, userId: userIdInt },
    });
    if (!dataSource) {
      return res.status(404).json({ message: "Fonte de dados não encontrada." });
    }

    switch (dataSource.origem_datasource) {
      case "RH":
        await prisma.identitiesHR.deleteMany({
          where: { dataSourceId: dataSourceId }
        });
        break;
      case "IDM":
        await prisma.identitiesIDM.deleteMany({
          where: { dataSourceId: dataSourceId }
        });
        break;
      case "SISTEMA":
        await prisma.assignment.deleteMany({
          where: {
            account: {
              system: {
                dataSourcesConfigs: {
                  some: { dataSourceId: dataSourceId }
                }
              }
            }
          }
        });
        
        await prisma.accounts.deleteMany({
          where: {
            system: {
              dataSourcesConfigs: {
                some: { dataSourceId: dataSourceId }
              }
            }
          }
        });
        
        await prisma.resource.deleteMany({
          where: {
            system: {
              dataSourcesConfigs: {
                some: { dataSourceId: dataSourceId }
              }
            }
          }
        });
        break;
      default:
        throw new Error("Origem de dados desconhecida.");
    }
    
    res.status(200).json({ message: `Dados da origem '${dataSource.origem_datasource}' limpos com sucesso.`});

  } catch (error) {
    console.error("Erro ao limpar dados processados:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * @route   GET /systems/all-resources
 * @desc    Busca TODOS os Recursos (Perfis de Sistema)
 * @access  Private
 */
const getAllResources = async (req, res) => {
  const userIdInt = parseInt(req.user.id, 10);
  if (isNaN(userIdInt)) {
    return res.status(400).json({ message: "ID de usuário inválido." });
  }

  try {
    const resources = await prisma.resource.findMany({
      where: {
        system: {
          dataSourcesConfigs: {
            some: {
              dataSource: {
                userId: userIdInt
              }
            }
          }
        }
      },
      select: {
        id: true,
        name_resource: true,
        systemId: true,
        system: {
          select: {
            name_system: true
          }
        }
      }
    });
    res.status(200).json(resources);
  } catch (error) {
    console.error("Erro ao buscar todos os Recursos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};


// Definindo as rotas
router.get("/", passport.authenticate("jwt", { session: false }), getDataSources);
router.post("/", passport.authenticate("jwt", { session: false }), createDataSource);
router.get("/all-resources", passport.authenticate("jwt", { session: false }), getAllResources);
router.get("/:id/data", passport.authenticate("jwt", { session: false }), getSystemData);
router.delete("/:id/data", passport.authenticate("jwt", { session: false }), clearSystemData);
router.post("/:id/mapping", passport.authenticate("jwt", { session: false }), saveOrUpdateMapping);
router.get("/:id", passport.authenticate("jwt", { session: false }), getDataSourceById);
router.patch("/:id", passport.authenticate("jwt", { session: false }), updateDataSource);
router.delete("/:id", passport.authenticate("jwt", { session: false }), deleteDataSource);

export default router;