import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { parseApiError } from '../utils/apiErrors';

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      const { message } = parseApiError(err, 'Invalid credentials');
      setError(message);
    }
  };

  return (
    <div className="flex min-h-full items-center justify-center bg-slate-50 px-4 py-12 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-slate-200 bg-white/90 p-8 shadow-xl backdrop-blur transition-colors dark:border-slate-700 dark:bg-slate-900/90">
        <div className="text-center">
          <img className="mx-auto h-16 w-auto" src="/logo.png" alt="Kiapat" />
          <h1 className="mt-6 text-3xl font-bold tracking-tight">Sign in to your account</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Enter your credentials to continue.</p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="-space-y-px rounded-md shadow-sm">
            <div>
              <label htmlFor="username" className="sr-only">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                autoComplete="username"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="relative block w-full rounded-t-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:z-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900"
                placeholder="Username"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full rounded-b-md border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 focus:z-10 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-white dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:placeholder-slate-400 dark:focus:border-brand-400 dark:focus:ring-brand-400 dark:focus:ring-offset-slate-900"
                placeholder="Password"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors hover:bg-brand-500 dark:focus-visible:ring-offset-slate-900"
            >
              Sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;