import { handleMockRequest } from './mockServer';

const USE_MOCK = typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_USE_MOCK === 'true';
const BASE_URL = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_URL) || 'http://localhost:3000/api';

async function mockRequest(method, url, options = {}) {
  // keep small delay to simulate network
  await new Promise((r) => setTimeout(r, 120));
  const response = handleMockRequest(method, url, options);
  const status = response.ok ? 200 : 400;
  return { status, data: response };
}

async function httpRequest(method, url, options = {}) {
  const fullUrlObject = new URL(`${BASE_URL}${url.startsWith('/') ? url : `/${url}`}`);

  if (options.params && typeof options.params === 'object') {
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        fullUrlObject.searchParams.set(key, String(value));
      }
    });
  }

  const fetchOptions = {
    method,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  };
  if (options.data) fetchOptions.body = JSON.stringify(options.data);

  const res = await fetch(fullUrlObject.toString(), fetchOptions);
  const text = await res.text();
  let data = text;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { /* not json */ }
  return { status: res.status, data };
}

const request = USE_MOCK ? mockRequest : httpRequest;

export const apiClient = {
  get(url, options = {}) { return request('GET', url, options); },
  post(url, data = {}, options = {}) { return request('POST', url, { ...options, data }); },
  put(url, data = {}, options = {}) { return request('PUT', url, { ...options, data }); },
  delete(url, options = {}) { return request('DELETE', url, options); },
};
