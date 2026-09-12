export const env = {
  apiUrl: import.meta.env.VITE_API_URL ?? '/api/v1',
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? window.location.origin,
};
