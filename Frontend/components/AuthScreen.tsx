import React, { useState, FormEvent } from 'react';
import type { User } from '../types';
import { UserCircleIcon, LockClosedIcon, BotIcon } from './icons';
import * as NeuzoApi from '../services/neuzoApi';

interface AuthScreenProps {
  onAuthSuccess: (user: User) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    if (!isLogin && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    setLoading(true);
    
    try {
      let data;
      if (isLogin) {
        data = await NeuzoApi.login(email, password);
      } else {
        data = await NeuzoApi.signup(email, password, fullName || undefined);
      }

      onAuthSuccess(data.user);
    } catch (err: unknown) {
      const err_ = err as { message?: string };
      setError(err_.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="panel w-full max-w-md p-6 sm:p-8">
      <div className="text-center mb-6">
        <BotIcon className="h-14 w-14 mx-auto text-blue-400 mb-2" />
        <h1 className="text-2xl font-bold text-white">Welcome to Neuzo</h1>
        <p className="text-sm text-gray-400">Verified news reports, on demand</p>
      </div>

      <div className="flex border-b border-white/10 mb-6" role="tablist" aria-label="Authentication mode">
        <button
          type="button"
          role="tab"
          aria-selected={isLogin}
          onClick={() => {
            setIsLogin(true);
            setError(null);
          }}
          className={`w-1/2 py-3 font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Log in
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isLogin}
          onClick={() => {
            setIsLogin(false);
            setError(null);
          }}
          className={`w-1/2 py-3 font-semibold transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${!isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200'}`}
        >
          Sign up
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {!isLogin && (
          <div className="relative">
            <label htmlFor="auth-full-name" className="sr-only">Full name (optional)</label>
            <UserCircleIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="auth-full-name"
              type="text"
              placeholder="Full name (optional)"
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="input pl-12 pr-4 py-3"
            />
          </div>
        )}

        <div className="relative">
          <label htmlFor="auth-email" className="sr-only">Email address</label>
          <UserCircleIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="auth-email"
            type="email"
            placeholder="Email address"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input pl-12 pr-4 py-3"
          />
        </div>

        <div className="relative">
          <label htmlFor="auth-password" className="sr-only">Password</label>
          <LockClosedIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            id="auth-password"
            type="password"
            placeholder="Password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input pl-12 pr-4 py-3"
          />
        </div>

        {!isLogin && (
          <div className="relative">
            <label htmlFor="auth-confirm-password" className="sr-only">Confirm password</label>
            <LockClosedIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="auth-confirm-password"
              type="password"
              placeholder="Confirm password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="input pl-12 pr-4 py-3"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="btn btn-primary w-full py-3 text-lg shadow-lg"
        >
          {loading ? 'Please wait…' : (isLogin ? 'Log in' : 'Create account')}
        </button>
      </form>
    </div>
  );
};