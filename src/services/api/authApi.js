import { apiClient } from '../core/apiClient';

export async function login(username, password) {
	const response = await apiClient.post('/auth/login', { username, password });
	return response.data;
}

export async function registerCustomer(payload) {
	const response = await apiClient.post('/auth/register/customer', payload);
	return response.data;
}

export async function registerOrganizer(payload) {
	const response = await apiClient.post('/auth/register/organizer', payload);
	return response.data;
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
