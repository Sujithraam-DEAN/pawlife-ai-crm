import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:8000/api' : 'https://pawlife-ai-crm.onrender.com/api'),
  timeout: 30000,
});

export default api;
