//material-react-app/src/keycloak.js
import Keycloak from "keycloak-js";

// Configuração de conexão com o servidor Keycloak (Dados Reais)
const keycloakConfig = {
  url: "https://nicolasec.forgetru.com.br/truam", 
  realm: "TAS",
  clientId: "mindTheGap",
};

const keycloak = new Keycloak(keycloakConfig);

export default keycloak;