import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Amplify } from 'aws-amplify';
import type { AuthUser } from 'aws-amplify/auth';
import { signIn, signOut, signUp, confirmSignUp, resendSignUpCode, getCurrentUser, fetchAuthSession } from 'aws-amplify/auth';
import type { SignInInput, SignUpInput, ConfirmSignUpInput, ResendSignUpCodeInput } from 'aws-amplify/auth';
import { awsConfig } from '../aws-config';

Amplify.configure(awsConfig);

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerificationCode: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  getAuthToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

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
    await signIn(signInInput);
    await checkUser();
  };

  const signup = async (email: string, password: string) => {
    const signUpInput: SignUpInput = {
      username: email,
      password: password,
      options: {
        userAttributes: { email },
      },
    };
    await signUp(signUpInput);
  };

  const verifyEmail = async (email: string, code: string) => {
    const confirmInput: ConfirmSignUpInput = {
      username: email,
      confirmationCode: code,
    };
    await confirmSignUp(confirmInput);
  };

  const resendVerificationCode = async (email: string) => {
    const resendInput: ResendSignUpCodeInput = {
      username: email,
    };
    await resendSignUpCode(resendInput);
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
    <AuthContext.Provider value={{ user, loading, login, signup, verifyEmail, resendVerificationCode, logout, getAuthToken }}>
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
