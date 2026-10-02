export const consentKey = 'owv:ai-connections:mcp-consent';
export async function mcpRequest(path: string, method = 'GET', body?: unknown) {
 const token = localStorage.token;
 if (!token) throw new Error('Connectez-vous à Open WebUI.');
 const response = await fetch('/cockpit-sessions/v1/mcp' + path, {
  method, credentials: 'same-origin', cache: 'no-store', redirect: 'error',
  headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) })
 });
 const data = await response.json();
 if (!response.ok) throw new Error(data.detail || 'AI Connections indisponible.');
 return data;
}
export async function startMcpConsent(id: string, contextKey: string) {
 const current = await mcpRequest('/context');
 if (current.context_key !== contextKey) throw new Error('Le compte a changé. Actualisez les connexions.');
 const result = await mcpRequest('/connections/' + encodeURIComponent(id) + '/authorize', 'POST', {});
 const url = new URL(result.authorization_url);
 const allowed = ['https://accounts.google.com/o/oauth2/v2/auth', 'https://console.apify.com/authorize/oauth', 'https://clerk.higgsfield.ai/oauth/authorize'];
 const state = url.searchParams.get('state');
 if (!allowed.includes(url.origin + url.pathname) || !state || !/^[A-Za-z0-9_-]{43}$/.test(state)) throw new Error('URL de consentement invalide.');
 sessionStorage.setItem(consentKey, JSON.stringify({ state, contextKey, expires: Date.now() + 600000 }));
 location.assign(url.href);
}
