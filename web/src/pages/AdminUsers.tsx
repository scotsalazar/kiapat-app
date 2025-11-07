import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/ToastProvider';
import { parseApiError } from '../utils/apiErrors';

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

  const inputStyles =
    'mt-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900';
  const secondaryButtonStyles =
    'rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-brand-500 hover:text-brand-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:border-brand-400 dark:hover:text-brand-300 dark:focus-visible:ring-offset-slate-900';

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
      const { message } = parseApiError(err, 'Failed to load users');
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
      setCreateSuccess('User created successfully');
      showToast('User created successfully', 'success');
      loadUsers();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to create user');
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
      setStatusMessage('User updated successfully');
      showToast('User updated successfully', 'success');
      setEditingUser(null);
      loadUsers();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to update user');
      setEditError(message);
      showToast(message, 'error');
    }
  };

  const handleResetPassword = async (user: ManagedUser) => {
    const newPassword = window.prompt(`Enter new password for ${user.username}`);
    if (!newPassword) return;
    setStatusMessage(null);
    try {
      await axios.post(
        `/api/users/${user.id}/reset-password`,
        { new_password: newPassword },
        { headers: authHeader },
      );
      setStatusMessage(`Password reset for ${user.username}`);
      showToast(`Password reset for ${user.username}`, 'success');
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to reset password');
      showToast(message, 'error');
    }
  };

  const handleDelete = async (user: ManagedUser) => {
    if (!window.confirm(`Delete user ${user.username}?`)) return;
    setStatusMessage(null);
    try {
      await axios.delete(`/api/users/${user.id}`, { headers: authHeader });
      setStatusMessage(`Deleted ${user.username}`);
      showToast(`Deleted ${user.username}`, 'success');
      loadUsers();
    } catch (err) {
      const { message } = parseApiError(err, 'Failed to delete user');
      showToast(message, 'error');
    }
  };

  return (
    <div className="space-y-6 p-4 text-slate-900 transition-colors md:p-6 dark:text-slate-100">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-bold">User Administration</h1>
        <div className="flex gap-2">
          <button type="button" className={secondaryButtonStyles} onClick={() => navigate('/inventory')}>
            Inventory
          </button>
          <button type="button" className={secondaryButtonStyles} onClick={() => navigate('/')}>
            Home
          </button>
        </div>
      </div>

      {statusMessage && <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{statusMessage}</div>}
      {loadError && <div className="text-sm font-medium text-red-600 dark:text-red-400">{loadError}</div>}

      <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <h2 className="mb-3 text-xl font-semibold">Create user</h2>
        <form className="grid gap-4 md:grid-cols-2" onSubmit={handleCreateSubmit}>
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Name</label>
            <input
              className={inputStyles}
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Username</label>
            <input
              className={inputStyles}
              value={createForm.username}
              onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
              required
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
            <input
              type="email"
              className={inputStyles}
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
          </div>
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Role</label>
            <select
              className={inputStyles}
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'driver' })}
            >
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="flex flex-col md:col-span-2">
            <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Password</label>
            <input
              type="password"
              className={inputStyles}
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
              required
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Passwords must include upper, lower and numeric characters.
            </p>
          </div>
          {createError && (
            <div className="text-sm font-medium text-red-600 md:col-span-2 dark:text-red-400">{createError}</div>
          )}
          {createSuccess && (
            <div className="text-sm font-medium text-emerald-600 md:col-span-2 dark:text-emerald-400">{createSuccess}</div>
          )}
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
            >
              Create user
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Existing users</h2>
          <button
            type="button"
            className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white disabled:cursor-not-allowed disabled:text-slate-400 dark:focus-visible:ring-offset-slate-900"
            onClick={loadUsers}
            disabled={loading}
          >
            Refresh
          </button>
        </div>
        {loading ? (
          <div className="text-sm text-slate-500 dark:text-slate-400">Loading users…</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-600 dark:border-slate-700 dark:text-slate-300">
                <tr>
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Username</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Created</th>
                  <th className="py-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                {users.map((user) => (
                  <tr key={user.id} className="bg-white/70 transition-colors dark:bg-slate-900/40">
                    <td className="py-2 pr-4 font-medium text-slate-800 dark:text-slate-100">{user.name}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{user.username}</td>
                    <td className="py-2 pr-4 text-slate-700 dark:text-slate-200">{user.email || '—'}</td>
                    <td className="py-2 pr-4 capitalize text-slate-700 dark:text-slate-200">{user.role}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-300">
                      {new Date(user.created_at).toLocaleString()}
                    </td>
                    <td className="flex flex-wrap gap-3 py-2">
                      <button
                        type="button"
                        className="text-sm font-semibold text-brand-600 transition-colors hover:text-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                        onClick={() => startEdit(user)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-amber-600 transition-colors hover:text-amber-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                        onClick={() => handleResetPassword(user)}
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-600 transition-colors hover:text-red-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
                        onClick={() => handleDelete(user)}
                      >
                        Delete
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
        <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur dark:border-slate-700 dark:bg-slate-900/80">
          <h2 className="mb-3 text-xl font-semibold">Edit {editingUser.username}</h2>
          <form className="grid gap-4 md:grid-cols-2" onSubmit={handleEditSubmit}>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Name</label>
              <input
                className={inputStyles}
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                required
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Email</label>
              <input
                type="email"
                className={inputStyles}
                value={editForm.email}
                onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Role</label>
              <select
                className={inputStyles}
                value={editForm.role}
                onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'driver' })}
              >
                <option value="driver">Driver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            {editError && (
              <div className="text-sm font-medium text-red-600 md:col-span-2 dark:text-red-400">{editError}</div>
            )}
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="submit"
                className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-slate-900"
              >
                Save changes
              </button>
              <button type="button" className={secondaryButtonStyles} onClick={() => setEditingUser(null)}>
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
};

export default AdminUsersPage;
