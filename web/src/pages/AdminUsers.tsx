import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';
import { formatDateTime } from '../utils/dateTime';

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

  const authHeader = useMemo(() => (token ? { Authorization: `Bearer ${token}` } : {}), [token]);
  const { showToast } = useToast();

  const loadUsers = async () => {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await axios.get<ManagedUser[]>('/api/users', { headers: authHeader });
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
      await axios.post(
        '/api/users',
        {
          name: createForm.name,
          username: createForm.username,
          email: createForm.email || null,
          password: createForm.password,
          role: createForm.role,
        },
        { headers: authHeader },
      );
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
      await axios.put(
        `/api/users/${editingUser.id}`,
        { name: editForm.name, email: editForm.email || null, role: editForm.role },
        { headers: authHeader },
      );
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
      await axios.post(
        `/api/users/${user.id}/reset-password`,
        { new_password: newPassword },
        { headers: authHeader },
      );
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
      await axios.delete(`/api/users/${user.id}`, { headers: authHeader });
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
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">{t('adminUsers.title')}</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => navigate('/inventory')}
          >
            {t('adminUsers.navigation.inventory')}
          </button>
          <button
            type="button"
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            onClick={() => navigate('/')}
          >
            {t('adminUsers.navigation.home')}
          </button>
        </div>
      </div>

      {statusMessage && <div className="text-green-600">{statusMessage}</div>}
      {loadError && <div className="text-red-600">{loadError}</div>}

      <section className="bg-white shadow rounded p-4">
        <h2 className="text-xl font-semibold mb-3">{t('adminUsers.create.title')}</h2>
        <form className="grid gap-3 md:grid-cols-2" onSubmit={handleCreateSubmit}>
          <div className="flex flex-col">
            <label className="text-sm font-medium">{t('adminUsers.create.name')}</label>
            <input
              className="border rounded px-3 py-2"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">{t('adminUsers.create.username')}</label>
            <input
              className="border rounded px-3 py-2"
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">{t('adminUsers.create.email')}</label>
            <input
              type="email"
              className="border rounded px-3 py-2"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-medium">{t('adminUsers.create.role')}</label>
            <select
              className="border rounded px-3 py-2"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'driver' })}
            >
              <option value="driver">{t('adminUsers.create.driver')}</option>
              <option value="admin">{t('adminUsers.create.admin')}</option>
            </select>
          </div>
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm font-medium">{t('adminUsers.create.password')}</label>
            <input
              type="password"
              className="border rounded px-3 py-2"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
            <p className="text-xs text-gray-500 mt-1">{t('adminUsers.create.passwordHelp')}</p>
          </div>
          {createError && <div className="text-red-600 md:col-span-2">{createError}</div>}
          {createSuccess && <div className="text-green-600 md:col-span-2">{createSuccess}</div>}
          <div className="md:col-span-2">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              {t('adminUsers.create.submit')}
            </button>
          </div>
        </form>
      </section>

      <section className="bg-white shadow rounded p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold">{t('adminUsers.existing.title')}</h2>
          <button type="button" className="text-sm text-blue-600" onClick={loadUsers} disabled={loading}>
            {t('adminUsers.existing.refresh')}
          </button>
        </div>
        {loading ? (
          <div>{t('adminUsers.existing.loading')}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">{t('adminUsers.existing.table.name')}</th>
                  <th className="py-2 pr-4">{t('adminUsers.existing.table.username')}</th>
                  <th className="py-2 pr-4">{t('adminUsers.existing.table.email')}</th>
                  <th className="py-2 pr-4">{t('adminUsers.existing.table.role')}</th>
                  <th className="py-2 pr-4">{t('adminUsers.existing.table.created')}</th>
                  <th className="py-2">{t('adminUsers.existing.table.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="py-2 pr-4">{user.name}</td>
                    <td className="py-2 pr-4">{user.username}</td>
                    <td className="py-2 pr-4">{user.email || t('common.notAvailable')}</td>
                    <td className="py-2 pr-4 capitalize">{user.role}</td>
                    <td className="py-2 pr-4">{formatDateTime(user.created_at)}</td>
                    <td className="py-2 flex gap-2 flex-wrap">
                      <button
                        type="button"
                        className="text-blue-600 hover:underline"
                        onClick={() => startEdit(user)}
                      >
                        {t('adminUsers.existing.edit')}
                      </button>
                      <button
                        type="button"
                        className="text-amber-600 hover:underline"
                        onClick={() => handleResetPassword(user)}
                      >
                        {t('adminUsers.existing.resetPassword')}
                      </button>
                      <button
                        type="button"
                        className="text-red-600 hover:underline"
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
        <section className="bg-white shadow rounded p-4">
          <h2 className="text-xl font-semibold mb-3">
            {t('adminUsers.edit.title', { username: editingUser.username })}
          </h2>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={handleEditSubmit}>
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t('adminUsers.edit.name')}</label>
              <input
                className="border rounded px-3 py-2"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t('adminUsers.edit.email')}</label>
              <input
                type="email"
                className="border rounded px-3 py-2"
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-medium">{t('adminUsers.edit.role')}</label>
              <select
                className="border rounded px-3 py-2"
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'driver' })}
              >
                <option value="driver">{t('adminUsers.create.driver')}</option>
                <option value="admin">{t('adminUsers.create.admin')}</option>
              </select>
            </div>
            {editError && <div className="text-red-600 md:col-span-2">{editError}</div>}
            <div className="flex gap-2 md:col-span-2">
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                {t('adminUsers.edit.save')}
              </button>
              <button
                type="button"
                className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
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
