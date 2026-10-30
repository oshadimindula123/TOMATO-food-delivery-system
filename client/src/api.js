const API = import.meta.env.VITE_API_URL || 'http://localhost:5000';
export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (!(typeof FormData !== 'undefined' && options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${API}/api${path}`, {
    credentials: 'include',
    ...options,
    headers
  });
  const data = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || 'Something went wrong. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
export function resolveImageUrl(src) {
  if (!src) return '';
  if (src.startsWith('/uploads/')) return `${API}${src}`;
  return src;
}
export { API };
