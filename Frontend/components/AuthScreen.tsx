import React, { useState, FormEvent } from 'react';
import { UserCircleIcon, LockClosedIcon, BotIcon } from './icons';
import * as NeuzoApi from '../services/neuzoApi';

interface AuthScreenProps {
  onAuthSuccess: () => void;
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
      if (isLogin) {
        await NeuzoApi.login(email, password);
      } else {
        await NeuzoApi.signup(email, password, fullName || undefined);
      }
      
      onAuthSuccess();
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-black/30 backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-white/10">
      <div className="text-center mb-6">
        <BotIcon className="h-16 w-16 mx-auto text-blue-400 mb-2" />
        <h1 className="text-3xl font-bold text-white">Welcome to Neuzo</h1>
        <p className="text-gray-300">Your Agentic News Bot</p>
      </div>

      <div className="flex border-b border-white/10 mb-6">
        <button
          onClick={() => {
            setIsLogin(true);
            setError(null);
          }}
          className={`w-1/2 py-3 text-lg font-semibold transition-colors duration-300 ${isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
        >
          Log In
        </button>
        <button
          onClick={() => {
            setIsLogin(false);
            setError(null);
          }}
          className={`w-1/2 py-3 text-lg font-semibold transition-colors duration-300 ${!isLogin ? 'text-blue-400 border-b-2 border-blue-400' : 'text-gray-400'}`}
        >
          Sign Up
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
            <UserCircleIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Full Name (optional)"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-white/20 bg-white/5 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        <div className="relative">
          <UserCircleIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="email"
            placeholder="Email Address"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-white/20 bg-white/5 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          />
        </div>

        <div className="relative">
          <LockClosedIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="password"
            placeholder="Password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-12 pr-4 py-3 border border-white/20 bg-white/5 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
          />
        </div>

        {!isLogin && (
          <div className="relative">
            <LockClosedIcon className="h-6 w-6 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="password"
              placeholder="Confirm Password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 border border-white/20 bg-white/5 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-colors"
            />
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-600 text-white font-bold text-lg rounded-lg shadow-lg hover:bg-blue-500 transition-all duration-200 transform hover:scale-105 disabled:bg-gray-600/50 disabled:transform-none disabled:cursor-not-allowed"
        >
          {loading ? 'Please wait...' : (isLogin ? 'Log In' : 'Create Account')}
        </button>
      </form>
    </div>
  );
};