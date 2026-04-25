export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL as string | undefined;
  if (configured) return configured.replace(/\/$/, "");

  const wsUrl = import.meta.env.VITE_WS_URL as string | undefined;
  if (wsUrl) return wsUrl.replace(/^ws/, "http").replace(/\/$/, "");

  return "http://localhost:8080";
}
