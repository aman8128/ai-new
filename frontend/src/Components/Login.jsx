import React, { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:8000/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Login failed');
      }

      const { access_token, user_data } = await response.json();
      localStorage.setItem('token', access_token);
      localStorage.setItem('user', JSON.stringify(user_data));
      navigate('/');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      const response = await fetch('http://localhost:8000/login/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: credentialResponse.credential }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Google login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user_data));
      navigate('/');
    } catch (err) {
      setError(err.message || 'Google login failed');
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Welcome Back</h2>
        <p style={styles.subtitle}>Sign in to continue to your account</p>

        {error && <div style={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="email" style={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="Enter your email"
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter your password"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              ...styles.button,
              ...(loading ? styles.buttonDisabled : {})
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div style={styles.divider}>
          <span style={styles.dividerText}>OR</span>
        </div>

        <div style={styles.socialLogin}>
          <GoogleLogin
            onSuccess={handleGoogleSuccess}
            onError={() => setError('Failed to sign in with Google')}
            size="large"
            text='signup_with'
          />
        </div>

        <p style={styles.footer}>
          Don't have an account?{' '}
          <a 
            href="/signup" 
            style={styles.link}
            onClick={(e) => {
              e.preventDefault();
              navigate('/signup');
            }}
          >
            Sign up
          </a>
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    backgroundColor: '#f8fafc',
    padding: '20px'
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
    padding: '32px',
    width: '100%',
    maxWidth: '400px'
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: '8px',
    textAlign: 'center'
  },
  subtitle: {
    fontSize: '14px',
    color: '#64748b',
    marginBottom: '24px',
    textAlign: 'center'
  },
  error: {
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    padding: '12px',
    borderRadius: '8px',
    marginBottom: '16px',
    fontSize: '14px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '14px',
    color: '#475569',
    fontWeight: '500'
  },
  input: {
    padding: '10px 12px',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    fontSize: '14px',
    backgroundColor: '#f8fafc',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    backgroundColor: '#2563eb',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
    marginTop: '8px',
    transition: 'background-color 0.2s'
  },
  buttonDisabled: {
    backgroundColor: '#93c5fd',
    cursor: 'not-allowed'
  },
  divider: {
    display: 'flex',
    alignItems: 'center',
    margin: '20px 0',
    color: '#cbd5e1'
  },
  dividerText: {
    padding: '0 10px',
    fontSize: '12px',
    color: '#64748b'
  },
  socialLogin: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '20px'
  },
  footer: {
    textAlign: 'center',
    fontSize: '14px',
    color: '#64748b'
  },
  link: {
    color: '#2563eb',
    fontWeight: '500',
    textDecoration: 'none',
    cursor: 'pointer'
  }
};

export default Login;