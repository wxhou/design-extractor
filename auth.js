import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import Google from 'next-auth/providers/google';
import Nodemailer from 'next-auth/providers/nodemailer';
import { TursoAdapter } from './src/auth-adapter.js';

const emailProvider = process.env.EMAIL_SERVER && process.env.EMAIL_FROM
  ? [Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    })]
  : [];

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: TursoAdapter(),
  providers: [
    GitHub,
    Google,
    ...emailProvider,
  ],
  session: { strategy: 'database' },
  pages: { signIn: '/dashboard' },
});
