import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true,
  timeout: 60000,
  headers: { Accept: 'application/json' }
});
let csrfToken = '';
let csrfPromise = null;

export const resetCsrfToken = () => {
  csrfToken = '';
  csrfPromise = null;
};

const unsafe = (method = 'get') => !['get', 'head', 'options'].includes(method.toLowerCase());

api.interceptors.request.use(async (request) => {
  if (unsafe(request.method) && !request.skipCsrf) {
    if (!csrfToken) {
      if (!csrfPromise) {
        csrfPromise = api.get('/auth/csrf').then((response) => {
          csrfToken = response?.data?.csrfToken || '';
          return csrfToken;
        }).finally(() => {
          csrfPromise = null;
        });
      }
      await csrfPromise;
    }
    if (!csrfToken) throw new Error('Could not establish a security token. Refresh the page and try again.');
    request.headers['X-CSRF-Token'] = csrfToken;
  }
  return request;
});

api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.data?.code === 'CSRF_INVALID' && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      resetCsrfToken();
      try {
        const response = await api.get('/auth/csrf');
        csrfToken = response?.data?.csrfToken || '';
        originalRequest.headers['X-CSRF-Token'] = csrfToken;
        return api(originalRequest);
      } catch {
        // Proceed with original error
      }
    }
    if (error.response?.data?.code === 'CSRF_INVALID') resetCsrfToken();

    let message = error.response?.data?.message;
    if (!message && error.response) {
      if (typeof Blob !== 'undefined' && error.response.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          const parsed = JSON.parse(text);
          message = parsed.message;
        } catch {
          message = error.response.status === 404 ? 'The requested file or resource was not found.' : `Server returned error (${error.response.status}).`;
        }
      } else {
        message = error.response.status === 404 ? 'The requested resource was not found.' : `Server returned error (${error.response.status}).`;
      }
    } else if (!message) {
      message = error.code === 'ECONNABORTED'
        ? 'The request took too long. Please try again.'
        : 'Cannot reach the DocuVerify API. Check the backend URL and server status.';
    }
    error.userMessage = message;
    return Promise.reject(error);
  }
);
export const getApiError = (error) => error?.userMessage || error?.response?.data?.message || error?.message || 'Something went wrong.';
export default api;
