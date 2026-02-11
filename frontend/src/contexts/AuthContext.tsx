import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import type { AuthUser } from 'aws-amplify/auth';
import { signIn, signOut, confirmSignIn, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import type { SignInInput } from 'aws-amplify/auth';
import { awsConfig } from '../aws-config';
import { signupUser } from '../services/api';

Amplify.configure(awsConfig);

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  completeNewPassword: (newPassword: string) => Promise<void>;
  signup: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
  requiresPasswordChange: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [requiresPasswordChange, setRequiresPasswordChange] = useState(false);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const signInInput: SignInInput = {
      username: email,
      password: password,
    };
    const result = await signIn(signInInput);

    // Check if user needs to change password (temporary password)
    if (result.nextStep.signInStep === 'CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED') {
      setRequiresPasswordChange(true);
      throw new Error('NEW_PASSWORD_REQUIRED');
    }

    await checkUser();
  };

  const completeNewPassword = async (newPassword: string) => {
    await confirmSignIn({
      challengeResponse: newPassword,
    });

    setRequiresPasswordChange(false);
    await checkUser();
  };

  const signup = async (email: string) => {
    // Call our backend API which uses AdminCreateUser
    // Cognito will email a temporary password to the user
    await signupUser(email);
    // User will receive temporary password via email
    // They must use it to login, then they'll be forced to change it
  };

  const logout = async () => {
    await signOut();
    setUser(null);
  };

  const getAuthToken = async (): Promise<string | null> => {
    try {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || null;
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, completeNewPassword, signup, logout, getAuthToken, requiresPasswordChange }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
