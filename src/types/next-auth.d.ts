import { DefaultSession } from 'auth'

declare module 'auth' {
  interface Session {
    provider?: string;
    providerAccountId?: string;
    companyId?: string;
  }

  interface User {
    companyId?: string;
  }
}

declare module 'auth/jwt' {
  interface JWT {
    provider?: string;
    providerAccountId?: string;
    companyId?: string;
  }
}

// Window interface extension for wizard validation functions
declare global {
  interface Window {
    __customerStepValidation?: () => boolean;
  }
}