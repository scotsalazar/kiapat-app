import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import { formatDateTime } from '../utils/dateTime';
import apiClient from '../api/axios';

interface ManagedUser {
  id: number;
  name: string;
  username: string;
  email: string | null;
  role: 'admin' | 'driver';
  created_at: string;
}

interface CreateFormState {
  name: string;
  username: string;
  email: string;
  password: string;
  role: 'admin' | 'driver';
}

interface EditFormState {
  name: string;
  email: string;
  role: 'admin' | 'driver';
}

const AdminUsersPage: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState<CreateFormState>({
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'driver',
  });
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>({ name: '', email: '', role: 'driver' });
  const [editError, setEditError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const { showToast } = useToast();

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await apiClient.get<ManagedUser[]>('/api/users');
      setUsers(res.data);
    } catch (err: any) {
      if (err.response?.status === 401) {
        logout();
        return;
      }
      const { message } = parseApiError(err, t('adminUsers.messages.loadError'));
      setLoadError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [token]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);
    setStatusMessage(null);
    try {
      await apiClient.post('/api/users', {
        name: createForm.name,
        username: createForm.username,
        email: createForm.email || null,
        password: createForm.password,
        role: createForm.role,
      });
      setCreateForm({ name: '', username: '', email: '', password: '', role: 'driver' });
      const successMessage = t('adminUsers.messages.createSuccess');
      setCreateSuccess(successMessage);
      showToast(successMessage, 'success');
      loadUsers();
    } catch (err) {
      const { message } = parseApiError(err, t('adminUsers.messages.createError'));
      setCreateError(message);
      showToast(message, 'error');
    }
  };

  const startEdit = (user: ManagedUser) => {
    setEditingUser(user);
    setEditForm({ name: user.name, email: user.email || '', role: user.role });
    setEditError(null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError(null);
    setStatusMessage(null);
    try {
      await apiClient.put(`/api/users/${editingUser.id}`, {
        name: editForm.name,
        email: editForm.email || null,
        role: editForm.role,
      });
      const successMessage = t('adminUsers.messages.updateSuccess');
      setStatusMessage(successMessage);
      showToast(successMessage, 'success');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      const { message } = parseApiError(err, t('adminUsers.messages.updateError'));
      setEditError(message);
      showToast(message, 'error');
    }
  };

  const handleResetPassword = async (user: ManagedUser) => {
    const newPassword = window.prompt(
      t('common.prompts.resetPassword', { username: user.username }),
    );
    if (!newPassword) return;
    setStatusMessage(null);
    try {
      await apiClient.post(`/api/users/${user.id}/reset-password`, {
        new_password: newPassword,
      });
      const successMessage = t('adminUsers.messages.resetSuccess', { username: user.username });
      setStatusMessage(successMessage);
      showToast(successMessage, 'success');
    } catch (err) {
      const { message } = parseApiError(err, t('adminUsers.messages.resetError'));
      showToast(message, 'error');
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (!window.confirm(t('common.prompts.deleteUser', { username: user.username }))) return;
    setStatusMessage(null);
    try {
      await apiClient.delete(`/api/users/${user.id}`);
      const successMessage = t('adminUsers.messages.deleteSuccess', { username: user.username });
      setStatusMessage(successMessage);
      showToast(successMessage, 'success');
      loadUsers();
    } catch (err) {
      const { message } = parseApiError(err, t('adminUsers.messages.deleteError'));
      showToast(message, 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{t('adminUsers.title')}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded px-4 py-2 transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            onClick={() => navigate('/inventory')}
          >
            {t('adminUsers.navigation.inventory')}
          </button>
          <button
            type="button"
            className="rounded px-4 py-2 transition-colors bg-slate-200 text-slate-800 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            onClick={() => navigate('/')}
          >
            {t('adminUsers.navigation.home')}
          </button>
        </div>
      </div>

      {statusMessage && <div className="text-green-600 dark:text-green-400">{statusMessage}</div>}
      {loadError && <div className="text-red-600 dark:text-red-400">{loadError}</div>}

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
        <h2 className="mb-3 text-xl font-semibold text-slate-900 dark:text-slate-100">{t('adminUsers.create.title')}</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateSubmit}>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.create.name')}</label>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.create.username')}</label>
            <input
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.create.email')}</label>
            <input
              type="email"
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.create.role')}</label>
            <select
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'driver' })}
            >
              <option value="driver">{t('adminUsers.create.driver')}</option>
              <option value="admin">{t('adminUsers.create.admin')}</option>
            </select>
          </div>
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.create.password')}</label>
            <input
              type="password"
              className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('adminUsers.create.passwordHelp')}</p>
          </div>
          {createError && <div className="md:col-span-2 text-red-600 dark:text-red-400">{createError}</div>}
          {createSuccess && <div className="md:col-span-2 text-green-600 dark:text-green-400">{createSuccess}</div>}
          <div className="md:col-span-2">
            <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900">
              {t('adminUsers.create.submit')}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">{t('adminUsers.existing.title')}</h2>
          <button type="button" className="text-sm text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300" onClick={loadUsers} disabled={loading}>
            {t('adminUsers.existing.refresh')}
          </button>
        </div>
        {loading ? (
          <div className="text-slate-600 dark:text-slate-300">{t('adminUsers.existing.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-600 dark:border-slate-700 dark:text-slate-300">
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.existing.table.name')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.existing.table.username')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.existing.table.email')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.existing.table.role')}</th>
                  <th className="py-2 pr-4 font-medium">{t('adminUsers.existing.table.created')}</th>
                  <th className="py-2 font-medium">{t('adminUsers.existing.table.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {users.map((user) => (
                  <tr key={user.id} className="bg-white transition-colors dark:bg-slate-900">
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{user.name}</td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{user.username}</td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{user.email || t('common.notAvailable')}</td>
                    <td className="py-2 pr-4 capitalize text-slate-900 dark:text-slate-100">{user.role}</td>
                    <td className="py-2 pr-4 text-slate-900 dark:text-slate-100">{formatDateTime(user.created_at)}</td>
                    <td className="flex flex-wrap gap-2 py-2">
                      <button
                        type="button"
                        className="text-blue-600 transition hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                        onClick={() => startEdit(user)}
                      >
                        {t('adminUsers.existing.edit')}
                      </button>
                      <button
                        type="button"
                        className="text-amber-600 transition hover:text-amber-500 dark:text-amber-400 dark:hover:text-amber-300"
                        onClick={() => handleResetPassword(user)}
                      >
                        {t('adminUsers.existing.resetPassword')}
                      </button>
                      <button
                        type="button"
                        className="text-red-600 transition hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                        onClick={() => handleDelete(user)}
                      >
                        {t('adminUsers.existing.delete')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {editingUser && (
        <section className="rounded border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900 dark:shadow-slate-900/40">
          <h2 className="mb-3 text-xl font-semibold text-slate-900 dark:text-slate-100">
            {t('adminUsers.edit.title', { username: editingUser.username })}
          </h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleEditSubmit}>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.edit.name')}</label>
              <input
                className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.edit.email')}</label>
              <input
                type="email"
                className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('adminUsers.edit.role')}</label>
              <select
                className="rounded border border-slate-300 px-3 py-2 text-slate-900 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'driver' })}
              >
                <option value="driver">{t('adminUsers.create.driver')}</option>
                <option value="admin">{t('adminUsers.create.admin')}</option>
              </select>
            </div>
            {editError && <div className="md:col-span-2 text-red-600 dark:text-red-400">{editError}</div>}
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="rounded bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-100 dark:focus:ring-offset-slate-900">
                {t('adminUsers.edit.save')}
              </button>
              <button
                type="button"
                className="rounded bg-slate-200 px-4 py-2 transition hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                onClick={() => setEditingUser(null)}
              >
                {t('adminUsers.edit.cancel')}
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};

export default AdminUsersPage;
