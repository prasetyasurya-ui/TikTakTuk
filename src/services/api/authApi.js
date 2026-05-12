import { apiClient } from '../core/apiClient';

function toAuthResult(response) {
	const data = response && typeof response.data === 'object' && response.data !== null ? response.data : {};
	return {
		ok: response.status >= 200 && response.status < 300,
		status: response.status,
		...data,
	};
}

export async function login(username, password) {
	const response = await apiClient.post('/auth/login', { username, password });
	return toAuthResult(response);
}

export async function registerCustomer(payload) {
	const response = await apiClient.post('/auth/register/customer', payload);
	return toAuthResult(response);
}

export async function registerOrganizer(payload) {
	const response = await apiClient.post('/auth/register/organizer', payload);
	return toAuthResult(response);
}

export async function registerAdmin(payload) {
	const response = await apiClient.post('/auth/register/admin', payload);
	return toAuthResult(response);
}

export async function logout() {
	await apiClient.post('/auth/logout');
}

export function getCurrentSession() {
	return {
		isLoggedIn: localStorage.getItem('isLoggedIn') === 'true',
		userId: localStorage.getItem('userId') || '',
		userRole: localStorage.getItem('userRole') || 'customer',
		userName: localStorage.getItem('userName') || 'User',
		username: localStorage.getItem('username') || '',
	};
}
