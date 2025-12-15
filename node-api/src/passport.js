import { ExtractJwt, Strategy as JWTStrategy } from "passport-jwt";
import jwksRsa from "jwks-rsa";
import dotenv from "dotenv";
import passport from "passport";

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

dotenv.config();

// Carrega as variáveis de ambiente
const KEYCLOAK_URL = process.env.KEYCLOAK_URL;
const KEYCLOAK_REALM = process.env.KEYCLOAK_REALM;

// Validação de segurança para não subir a API sem configuração
if (!KEYCLOAK_URL || !KEYCLOAK_REALM) {
  console.error("ERRO CRÍTICO: Variáveis KEYCLOAK_URL e KEYCLOAK_REALM não definidas no .env");
  process.exit(1);
}

// Monta as URLs dinamicamente
const JWKS_URI = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/certs`;
const ISSUER_URI = `${KEYCLOAK_URL}/realms/${KEYCLOAK_REALM}`;

passport.use(
  new JWTStrategy(
    {
      // 1. Onde buscar o token? (Header Authorization: Bearer ...)
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      
      // 2. Como validar a assinatura? (Busca a chave pública no Keycloak)
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,             
        rateLimit: true,         
        jwksRequestsPerMinute: 5,
        jwksUri: JWKS_URI,       
      }),

      // 3. Validações extras
      issuer: ISSUER_URI,        // Garante que veio do TAS
      algorithms: ["RS256"],     // Algoritmo assimétrico padrão
    },
    async function (jwtPayload, done) {
      try {
        // --- LÓGICA DE VÍNCULO ---
        // O ID numérico do Postgres não existe no token do Keycloak.
        // Usamos o EMAIL como chave de correlação.
        
        if (!jwtPayload.email) {
            console.warn("Token recebido sem campo 'email'.");
            return done(null, false);
        }

        const user = await prisma.user.findUnique({
          where: {
            email: jwtPayload.email, // Busca o usuário pelo e-mail do token
          },
          include: {
            profile: true,
            package: {
              include: {
                platforms: true,
              },
            },
          },
        });

        if (user) {
          // Sucesso: Token válido e usuário existe no banco local.
          return done(null, user);
        } else {
          // Falha: Token válido, mas usuário não cadastrado no Portal.
          // Retorna 401 Unauthorized.
          console.warn(`Acesso negado: E-mail ${jwtPayload.email} autenticado no Keycloak mas não cadastrado no banco local.`);
          return done(null, false);
        }
      } catch (error) {
        console.error("Erro na estratégia JWT:", error);
        return done(error, false);
      }
    }
  )
);