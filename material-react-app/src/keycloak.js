//material-react-app/src/keycloak.js
import Keycloak from "keycloak-js";

// Configuração de conexão com o servidor Keycloak (Dados Reais)
const keycloakConfig = {
  url: "https://tas.nicolasec.com.br/truam", 
  realm: "TAS",
  clientId: "mindTheGapTas",
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;