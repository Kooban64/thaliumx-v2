"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKeycloak = getKeycloak;
exports.initKeycloak = initKeycloak;
exports.login = login;
exports.logout = logout;
const keycloak_js_1 = __importDefault(require("keycloak-js"));
let keycloak = null;
function getKeycloak() {
    if (!keycloak) {
        keycloak = new keycloak_js_1.default({
            url: process.env.NEXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
            realm: process.env.NEXT_PUBLIC_KEYCLOAK_REALM || 'thaliumx-tenant',
            clientId: process.env.NEXT_PUBLIC_KEYCLOAK_CLIENT_ID || 'thaliumx-frontend'
        });
    }
    return keycloak;
}
async function initKeycloak() {
    const kc = getKeycloak();
    const authenticated = await kc.init({ onLoad: 'check-sso', silentCheckSsoRedirectUri: window.location.origin + '/silent-check-sso.html' });
    if (authenticated && kc.token) {
        localStorage.setItem('authToken', kc.token);
        return kc.token;
    }
    return null;
}
async function login() {
    const kc = getKeycloak();
    await kc.login();
}
async function logout() {
    const kc = getKeycloak();
    await kc.logout();
    localStorage.removeItem('authToken');
}
//# sourceMappingURL=keycloak.js.map