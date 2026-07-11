import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

const providers: any[] = [];

// Google Provider (if configured)
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  providers.push(Google({
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    authorization: {
      params: {
        prompt: "consent",
        access_type: "offline",
        response_type: "code"
      }
    }
  }));
}

// Microsoft Provider (if configured) - Not available in NextAuth v5 beta yet
// TODO: Add Microsoft provider when available in NextAuth v5 stable release
// if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
//   const Microsoft = await import('next-auth/providers/microsoft');
//   providers.push(Microsoft({
//     clientId: process.env.MICROSOFT_CLIENT_ID,
//     clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
//     authorization: {
//       params: {
//         prompt: "consent",
//         response_type: "code"
//       }
//     }
//   }));
// }

// Microsoft Provider (if configured)
// Note: Microsoft provider not available in NextAuth v5 beta yet
// Uncomment when provider becomes available
// if (process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET) {
//   try {
//     const microsoftProvider = await import('next-auth/providers/microsoft');
//     providers.push(microsoftProvider.Microsoft({
//       clientId: process.env.MICROSOFT_CLIENT_ID,
//       clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
//       authorization: {
//         params: {
//           prompt: "consent",
//           response_type: "code"
//         }
//       }
//     }));
//   } catch (error) {
//     console.warn('Microsoft provider not available in this NextAuth version');
//   }
// }

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers,
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      if (account && user) {
        token.provider = account.provider;
        token.providerAccountId = account.providerAccountId;
        token.email = profile?.email || user.email;
        token.emailVerified = profile?.email_verified || false;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.provider = token.provider as string;
        session.providerAccountId = token.providerAccountId as string;
      }
      return session;
    }
  }
});