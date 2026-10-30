import { useState } from 'react';
import { ShieldCheck, Mail, Lock, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api } from './api';

export function AdminLogin({ onLoginSuccess, onExit, currentUser }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    try {
      const data = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password })
      });

      if (!data.user) {
        throw new Error('Authentication failed. No user returned.');
      }

      if (data.user.role !== 'admin') {
        // Log out immediately since the role is not admin
        await api('/auth/logout', { method: 'POST' }).catch(() => {});
        throw new Error('Access denied: This account does not have administrator privileges. Please sign in with an admin account.');
      }

      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your email and password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Brand Logo */}
        <div className="flex justify-center items-center gap-3">
          <div className="w-12 h-12 bg-red-600 text-white rounded-2xl flex items-center justify-center font-extrabold text-3xl shadow-md -rotate-6">
            t
          </div>
          <div className="text-left">
            <span className="font-extrabold text-2xl tracking-tight text-gray-900 block leading-none">
              TOMATO<span className="text-red-600">.</span>
            </span>
            <span className="text-[10px] tracking-widest font-bold text-gray-500 uppercase mt-1 block">
              Admin Portal
            </span>
          </div>
        </div>

        <h2 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-900">
          Administrator Sign In
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Enter your administrator credentials to access the management dashboard.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-sm rounded-2xl border border-gray-200 sm:px-10">
          {currentUser && currentUser.role !== 'admin' && (
            <div className="mb-5 p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-sm text-amber-800">
              <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Currently signed in as customer</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  You are logged in as <strong>{currentUser.email}</strong>, which does not have admin access. Sign in below with an administrator account.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 text-sm text-red-700" role="alert">
              <AlertCircle size={18} className="text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{error}</div>
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5" htmlFor="admin-email">
                Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Mail size={17} />
                </div>
                <input
                  id="admin-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@example.com"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5" htmlFor="admin-password">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                  <Lock size={17} />
                </div>
                <input
                  id="admin-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-10 pr-3.5 py-2.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-bold text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 transition-colors"
            >
              {busy ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={18} />
                  <span>Sign In to Dashboard</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-200">
            <button
              type="button"
              onClick={onExit}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-xs font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={15} />
              <span>Back to Customer Storefront</span>
            </button>
          </div>

          <div className="mt-5 p-3 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-500 space-y-1">
            <p className="font-semibold text-gray-700">Administrator access requirement:</p>
            <p>Only users with the <code className="bg-gray-200 px-1 py-0.5 rounded text-gray-800 font-mono text-[11px]">admin</code> role in MongoDB can access dashboard pages and admin APIs.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
