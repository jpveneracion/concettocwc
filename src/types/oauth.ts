// OAuth provider types
export type OAuthProvider = 'google' | 'microsoft' | 'pi';

export interface OAuthAccount {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  provider_user_id: string;
  email: string | null;
  username: string | null;
  wallet_address: string | null;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface PiUserInfo {
  uid: string;
  username: string;
  wallet_address?: string;
}

export interface OAuthUserInfo {
  id: string;
  email: string;
  name: string;
  verified_email: boolean;
  provider: OAuthProvider;
}

export interface AccountLinkRequest {
  provider: OAuthProvider;
  provider_user_id: string;
  email: string | null;
  username?: string;
  wallet_address?: string;
  access_token?: string;
  refresh_token?: string;
  expires_at?: Date | null;
}

export interface AccountChoiceData {
  action: 'join' | 'create';
  company_code?: string;
  company_name?: string;
  company_address?: string;
  company_mobile?: string;
  company_email?: string;
  email: string; // Required for Pi users
}