import { handleMockRequest } from './mockServer';

const NETWORK_DELAY_MS = 120;

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function request(method, url, options = {}) {
  await delay(NETWORK_DELAY_MS);

  const response = handleMockRequest(method, url, options);
  const status = response.ok ? 200 : 400;

  return {
    status,
    data: response,
  };
}

export const apiClient = {
  get(url, options = {}) {
    return request('GET', url, options);
  },
  post(url, data = {}, options = {}) {
    return request('POST', url, { ...options, data });
  },
  put(url, data = {}, options = {}) {
    return request('PUT', url, { ...options, data });
  },
  delete(url, options = {}) {
    return request('DELETE', url, options);
  },
};
