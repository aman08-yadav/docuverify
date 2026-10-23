import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 60000,
  headers: { Accept: 'application/json' }
});
let csrfToken = '';
const unsafe = (method = 'get') => !['get', 'head', 'options'].includes(method.toLowerCase());
api.interceptors.request.use(async (request) => {
  if (unsafe(request.method) && !request.skipCsrf) {
    if (!csrfToken) {
      const response = await api.get('/auth/csrf');
      csrfToken = response?.data?.csrfToken || '';
    }
    if (!csrfToken) throw new Error('Could not establish a security token. Refresh the page and try again.');
    request.headers['X-CSRF-Token'] = csrfToken;
  }
  return request;
});
api.interceptors.response.use((response) => response.data, (error) => {
  if (error.response?.data?.code === 'CSRF_INVALID') csrfToken = '';
  const message = error.response?.data?.message || (error.code === 'ECONNABORTED' ? 'The request took too long. Please try again.' : 'Cannot reach the DocuVerify API. Check the backend URL and server status.');
  error.userMessage = message;
  return Promise.reject(error);
});
export const getApiError = (error) => error?.userMessage || error?.response?.data?.message || error?.message || 'Something went wrong.';
export default api;
