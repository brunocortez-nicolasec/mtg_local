import Axios from "axios";

const API_URL = process.env.REACT_APP_API_URL; 
Axios.defaults.baseURL = API_URL;

export class HttpService {
  _axios = Axios.create();

  addRequestInterceptor = (onFulfilled, onRejected) => {
    this._axios.interceptors.request.use(onFulfilled, onRejected);
  };

  addResponseInterceptor = (onFulfilled, onRejected) => {
    this._axios.interceptors.response.use(onFulfilled, onRejected);
  };

  get = async (url) => await this.request(this.getOptionsConfig("get", url));

  post = async (url, data) => await this.request(this.getOptionsConfig("post", url, data));

  put = async (url, data) => await this.request(this.getOptionsConfig("put", url, data));

  patch = async (url, data) => await this.request(this.getOptionsConfig("patch", url, data));

  delete = async (url) => await this.request(this.getOptionsConfig("delete", url));

  getOptionsConfig = (method, url, data) => {
    return {
      method,
      url,
      data,
      headers: { 
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    };
  };

  // --- FUNÇÃO REQUEST CORRIGIDA ---
  request(options) {
    return new Promise((resolve, reject) => {
      this._axios
        .request(options)
        .then((res) => resolve(res.data))
        .catch((ex) => {
          // 1. Verifica se existe uma resposta do servidor (erro de API, ex: 401, 404, 500)
          if (ex.response && ex.response.data) {
            reject(ex.response.data);
          } else {
            // 2. Se não houver resposta, é um erro de rede (servidor offline, etc.)
            // Criamos um objeto de erro padrão para não quebrar a aplicação.
            reject({ message: ex.message || "Erro de rede ou servidor indisponível." });
          }
        });
    });
  }
}

export default new HttpService();