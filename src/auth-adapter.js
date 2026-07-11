import { randomUUID } from 'crypto';
import { getDb } from './db.js';

const FREE_MONTHLY_QUOTA = 100;

function toDbDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  return new Date(value).toISOString();
}

function fromDbDate(value) {
  return value ? new Date(value) : null;
}

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? null,
    image: row.image ?? null,
    emailVerified: fromDbDate(row.email_verified),
  };
}

function mapAccount(row) {
  if (!row) return null;
  return {
    userId: row.user_id,
    type: row.type,
    provider: row.provider,
    providerAccountId: row.provider_account_id,
    refresh_token: row.refresh_token ?? null,
    access_token: row.access_token ?? null,
    expires_at: row.expires_at ?? null,
    token_type: row.token_type ?? null,
    scope: row.scope ?? null,
    id_token: row.id_token ?? null,
    session_state: row.session_state ?? null,
  };
}

function mapSession(row) {
  if (!row) return null;
  return {
    sessionToken: row.session_token,
    userId: row.user_id,
    expires: new Date(row.expires),
  };
}

function mapVerificationToken(row) {
  if (!row) return null;
  return {
    identifier: row.identifier,
    token: row.token,
    expires: new Date(row.expires),
  };
}

export function TursoAdapter({ db } = {}) {
  async function execute(sql, args = []) {
    const client = db ?? await getDb();
    return client.execute({ sql, args });
  }

  async function getUser(id) {
    const result = await execute('SELECT * FROM users WHERE id = ?', [id]);
    return mapUser(result.rows[0]);
  }

  async function getSession(sessionToken) {
    const result = await execute('SELECT * FROM sessions WHERE session_token = ?', [sessionToken]);
    return mapSession(result.rows[0]);
  }

  return {
    async createUser(user) {
      if (!user.email) {
        throw new Error('Auth user email is required');
      }

      const id = user.id ?? randomUUID();
      const now = new Date().toISOString();
      const createdUser = {
        id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ?? null,
      };

      await execute(
        `INSERT INTO users (id, email, name, image, email_verified, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          createdUser.id,
          createdUser.email,
          createdUser.name,
          createdUser.image,
          toDbDate(createdUser.emailVerified),
          now,
        ],
      );
      await execute(
        `INSERT INTO subscriptions (user_id, plan, status, updated_at)
         VALUES (?, ?, ?, ?)`,
        [createdUser.id, 'free', 'active', now],
      );
      await execute(
        `INSERT INTO credit_balances (user_id, monthly_quota, monthly_used, pack_balance, period_start, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [createdUser.id, FREE_MONTHLY_QUOTA, 0, 0, now, now],
      );

      return createdUser;
    },

    getUser,

    async getUserByEmail(email) {
      const result = await execute('SELECT * FROM users WHERE email = ?', [email]);
      return mapUser(result.rows[0]);
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const result = await execute(
        `SELECT users.*
         FROM users
         INNER JOIN accounts ON accounts.user_id = users.id
         WHERE accounts.provider = ? AND accounts.provider_account_id = ?`,
        [provider, providerAccountId],
      );
      return mapUser(result.rows[0]);
    },

    async updateUser(user) {
      const existing = await getUser(user.id);
      if (!existing) return null;

      const next = {
        ...existing,
        ...user,
        emailVerified: user.emailVerified === undefined ? existing.emailVerified : user.emailVerified,
      };
      await execute(
        `UPDATE users
         SET email = ?, name = ?, image = ?, email_verified = ?
         WHERE id = ?`,
        [next.email, next.name ?? null, next.image ?? null, toDbDate(next.emailVerified), next.id],
      );
      return next;
    },

    async linkAccount(account) {
      await execute(
        `INSERT INTO accounts (
          id, user_id, type, provider, provider_account_id, refresh_token, access_token,
          expires_at, token_type, scope, id_token, session_state
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          randomUUID(),
          account.userId,
          account.type,
          account.provider,
          account.providerAccountId,
          account.refresh_token ?? null,
          account.access_token ?? null,
          account.expires_at ?? null,
          account.token_type ?? null,
          account.scope ?? null,
          account.id_token ?? null,
          account.session_state ?? null,
        ],
      );
      return account;
    },

    async getAccount(providerAccountId, provider) {
      const result = await execute(
        'SELECT * FROM accounts WHERE provider = ? AND provider_account_id = ?',
        [provider, providerAccountId],
      );
      return mapAccount(result.rows[0]);
    },

    async createSession(session) {
      await execute(
        `INSERT INTO sessions (id, session_token, user_id, expires)
         VALUES (?, ?, ?, ?)`,
        [randomUUID(), session.sessionToken, session.userId, toDbDate(session.expires)],
      );
      return {
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },

    async getSessionAndUser(sessionToken) {
      const result = await execute(
        `SELECT
          sessions.session_token, sessions.user_id, sessions.expires,
          users.id, users.email, users.name, users.image, users.email_verified
         FROM sessions
         INNER JOIN users ON sessions.user_id = users.id
         WHERE sessions.session_token = ?`,
        [sessionToken],
      );
      const row = result.rows[0];
      if (!row) return null;

      return {
        session: mapSession(row),
        user: mapUser(row),
      };
    },

    async updateSession(session) {
      const existing = await getSession(session.sessionToken);
      if (!existing) return null;

      const next = {
        ...existing,
        ...session,
        expires: session.expires ?? existing.expires,
      };
      await execute(
        `UPDATE sessions
         SET user_id = ?, expires = ?
         WHERE session_token = ?`,
        [next.userId, toDbDate(next.expires), next.sessionToken],
      );
      return next;
    },

    async deleteSession(sessionToken) {
      const session = await getSession(sessionToken);
      await execute('DELETE FROM sessions WHERE session_token = ?', [sessionToken]);
      return session;
    },

    async createVerificationToken(verificationToken) {
      await execute(
        `INSERT INTO verification_tokens (identifier, token, expires)
         VALUES (?, ?, ?)`,
        [
          verificationToken.identifier,
          verificationToken.token,
          toDbDate(verificationToken.expires),
        ],
      );
      return verificationToken;
    },

    async useVerificationToken({ identifier, token }) {
      const result = await execute(
        'SELECT * FROM verification_tokens WHERE identifier = ? AND token = ?',
        [identifier, token],
      );
      const verificationToken = mapVerificationToken(result.rows[0]);
      if (!verificationToken) return null;

      await execute(
        'DELETE FROM verification_tokens WHERE identifier = ? AND token = ?',
        [identifier, token],
      );
      return verificationToken;
    },
  };
}
