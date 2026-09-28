import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Nodemailer from 'next-auth/providers/nodemailer';
import { TursoAdapter } from './src/auth-adapter.js';

export const hasEmailProvider = Boolean(process.env.EMAIL_SERVER && process.env.EMAIL_FROM);

const emailProvider = hasEmailProvider
  ? [Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    })]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: TursoAdapter(),
  providers: [
    GitHub,
    ...emailProvider,
  ],
  session: { strategy: 'database' },
  pages: { signIn: '/dashboard' },
});
