'use client';
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = KeycloakAuth;
const react_1 = require("react");
const keycloak_1 = require("@/lib/keycloak");
function KeycloakAuth() {
    const [token, setToken] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    (0, react_1.useEffect)(() => {
        (async () => {
            try {
                const t = await (0, keycloak_1.initKeycloak)();
                setToken(t);
            }
            finally {
                setLoading(false);
            }
        })();
    }, []);
    if (loading)
        return <div className="text-sm">Checking session...</div>;
    return (<div className="flex items-center gap-2">
      {token ? (<>
          <span className="text-xs text-green-700">Signed in</span>
          <button className="px-3 py-1 border rounded" onClick={keycloak_1.logout}>Logout</button>
        </>) : (<button className="px-3 py-1 border rounded" onClick={keycloak_1.login}>Login</button>)}
    </div>);
}
//# sourceMappingURL=KeycloakAuth.js.map