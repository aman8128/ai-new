import React, { useState } from "react";
import { GoogleLogin } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";

const Signup = () => {
  const [formData, setFormData] = useState({
    username: "",
    email: "",
    password: "",
  });
  const [status, setStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleManualSignup = async (e) => {
    e.preventDefault();
    setStatus(null);
    setIsLoading(true);
    
    try {
      const res = await fetch("http://localhost:8000/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });
      
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || "Signup failed");
      }
      navigate('/login');
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Signup failed" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (googleData) => {
    setIsLoading(true);
    try {
      const response = await fetch('http://localhost:8000/signup/google', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: googleData.credential
        })
      });

      const data = await response.json();
      
      if (data.status === "success") {
        localStorage.setItem('user', JSON.stringify({
          user_id: data.user_id,
          ...data.profile_data
        }));
        navigate('/');
      } else {
        throw new Error(data.message || "Google signup failed");
      }
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Google signup failed" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="signup-container" style={styles.container}>
      <div style={styles.logoContainer}>
        <h2 style={styles.heading}>Create Your Account</h2>
        <p style={styles.subHeading}>Join our community today</p>
      </div>
      
      <form onSubmit={handleManualSignup} style={styles.form}>
        <div style={styles.inputGroup}>
          <label htmlFor="username" style={styles.label}>Username</label>
          <input
            id="username"
            name="username"
            placeholder="Enter your username"
            onChange={handleChange}
            value={formData.username}
            required
            style={styles.input}
          />
        </div>
        
        <div style={styles.inputGroup}>
          <label htmlFor="email" style={styles.label}>Email</label>
          <input
            id="email"
            type="email"
            name="email"
            placeholder="Enter your email"
            onChange={handleChange}
            value={formData.email}
            required
            style={styles.input}
          />
        </div>
        
        <div style={styles.inputGroup}>
          <label htmlFor="password" style={styles.label}>Password</label>
          <input
            id="password"
            type="password"
            name="password"
            placeholder="Create a password"
            onChange={handleChange}
            value={formData.password}
            required
            style={styles.input}
          />
        </div>
        
        <button 
          type="submit" 
          style={styles.button}
          disabled={isLoading}
        >
          {isLoading ? (
            <span style={styles.loader}>Creating account...</span>
          ) : (
            "Sign Up"
          )}
        </button>
      </form>

      <div style={styles.divider}>
        <span style={styles.dividerText}>OR</span>
      </div>

      <div style={styles.socialLogin}>
        <GoogleLogin 
          onSuccess={handleGoogleSuccess} 
          onError={() => {
            setStatus({ type: "error", message: "Google login failed" });
          }}
          size="large"
          text="signup_with"
        />
      </div>

      {status && (
        <div style={status.type === "error" ? styles.error : styles.success}>
          {status.message}
        </div>
      )}

      <p style={styles.loginLink}>
        Already have an account?{' '}
        <a 
          href="/login" 
          style={styles.link}
          onClick={(e) => {
            e.preventDefault();
            navigate('/login');
          }}
        >
          Log in
        </a>
      </p>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "450px",
    margin: "auto",
    padding: "2.5rem",
    borderRadius: "12px",
    marginTop: "3rem",
    textAlign: "center",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)",
    backgroundColor: "#ffffff",
  },
  logoContainer: {
    marginBottom: "2rem",
  },
  heading: {
    fontSize: "1.8rem",
    fontWeight: "600",
    color: "#2d3748",
    marginBottom: "0.5rem",
  },
  subHeading: {
    fontSize: "0.95rem",
    color: "#718096",
    marginBottom: "0",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
  inputGroup: {
    textAlign: "left",
  },
  label: {
    display: "block",
    marginBottom: "0.5rem",
    fontSize: "0.9rem",
    color: "#4a5568",
    fontWeight: "500",
  },
  input: {
    width: "100%",
    padding: "0.8rem 1rem",
    fontSize: "0.95rem",
    borderRadius: "8px",
    border: "1px solid #e2e8f0",
    backgroundColor: "#f8fafc",
    transition: "all 0.2s",
    boxSizing: "border-box",
  },
  inputFocus: {
    outline: "none",
    borderColor: "#4299e1",
    boxShadow: "0 0 0 3px rgba(66, 153, 225, 0.2)",
  },
  button: {
    padding: "0.9rem",
    background: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "1rem",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.2s",
    marginTop: "0.5rem",
  },
  buttonHover: {
    background: "#2563eb",
  },
  divider: {
    position: "relative",
    margin: "1.5rem 0",
    color: "#cbd5e0",
  },
  dividerText: {
    position: "relative",
    padding: "0 1rem",
    backgroundColor: "#ffffff",
    fontSize: "0.85rem",
    color: "#718096",
  },
  socialLogin: {
    marginBottom: "1.5rem",
    display: "flex",
    justifyContent: "center",
  },
  error: {
    color: "#e53e3e",
    backgroundColor: "#fff5f5",
    padding: "0.8rem",
    borderRadius: "8px",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  success: {
    color: "#38a169",
    backgroundColor: "#f0fff4",
    padding: "0.8rem",
    borderRadius: "8px",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  loginLink: {
    fontSize: "0.95rem",
    color: "#4a5568",
  },
  link: {
    color: "#3b82f6",
    fontWeight: "500",
    textDecoration: "none",
    cursor: "pointer",
  },
  loader: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
};

export default Signup;