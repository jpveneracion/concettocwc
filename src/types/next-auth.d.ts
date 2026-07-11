import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    provider?: string;
    providerAccountId?: string;
    companyId?: string;
  }

  interface User {
    companyId?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    provider?: string;
    providerAccountId?: string;
    companyId?: string;
  }
}