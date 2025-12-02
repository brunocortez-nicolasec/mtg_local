// node-api/src/services/resources/index.js
// API para gerenciar o *Catálogo* de Recursos (model Resource)

import express from "express";
import passport from "passport";
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const router = express.Router();

/**
 * @route   GET /resources
 * @desc    Busca todos os Recursos (do catálogo) com seus Aliases
 * @access  Private
 */
const getResources = async (req, res) => {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { name_resource: 'asc' },
      include: {
        system: {
          select: { name_system: true }
        }
      }
    });
    res.status(200).json(resources);
  } catch (error) {
    console.error("Erro ao buscar catálogo de Recursos:", error);
    res.status(500).json({ message: "Erro interno do servidor." });
  }
};

/**
 * @route   PATCH /resources/:id
 * @desc    Atualiza um recurso (focado em salvar Aliases)
 * @access  Private
 */
const updateResource = async (req, res) => {
    const { id } = req.params;
    const { aliases } = req.body; // Espera um array: ["Apelido 1", "Apelido 2"]

    if (!id) return res.status(400).json({ message: "ID do recurso é obrigatório." });

    try {
        // Validação básica: Aliases deve ser um array (ou null para limpar)
        if (aliases !== undefined && aliases !== null && !Array.isArray(aliases)) {
            return res.status(400).json({ message: "O campo 'aliases' deve ser uma lista de textos." });
        }

        const updatedResource = await prisma.resource.update({
            where: { id: parseInt(id, 10) },
            data: {
                aliases: aliases // O Prisma converte automaticamente array JS para JSON no Postgres
            }
        });

        res.status(200).json(updatedResource);
    } catch (error) {
        console.error("Erro ao atualizar recurso:", error);
        if (error.code === 'P2025') {
            return res.status(404).json({ message: "Recurso não encontrado." });
        }
        res.status(500).json({ message: "Erro ao atualizar o recurso." });
    }
};

// Definindo as rotas
router.get("/", passport.authenticate("jwt", { session: false }), getResources);
router.patch("/:id", passport.authenticate("jwt", { session: false }), updateResource); // Nova rota

export default router;