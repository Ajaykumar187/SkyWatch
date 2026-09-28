import crypto from "crypto";
import { UserRepository, SessionRepository, DbUser } from "./db";

export interface StoredUser {
  id?: string;
  username: string;
  email: string;
  salt: string;
  passwordHash: string;
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString("hex");
}

function safeCompare(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a, "hex");
    const bufB = Buffer.from(b, "hex");
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export async function createUser(
  username: string,
  email: string,
  password: string
): Promise<{ ok: boolean; message: string; user?: DbUser }> {
  const cleanUsername = username.trim();
  const cleanEmail = email.trim().toLowerCase();

  if (cleanUsername.length < 3) {
    return { ok: false, message: "Username must be at least 3 characters." };
  }
  if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
    return { ok: false, message: "Please enter a valid email address." };
  }
  if (password.length < 6) {
    return { ok: false, message: "Password must be at least 6 characters." };
  }

  const existing = await UserRepository.findByUsername(cleanUsername);
  if (existing) {
    return { ok: false, message: "Username already exists." };
  }

  const salt = crypto.randomBytes(16).toString("hex");
  const passwordHash = hashPassword(password, salt);

  const user = await UserRepository.create({
    username: cleanUsername,
    email: cleanEmail,
    salt,
    passwordHash,
  });

  return { ok: true, message: "Account created.", user };
}

export async function verifyUser(
  username: string,
  password: string
): Promise<{ ok: boolean; message: string; user?: DbUser }> {
  const cleanUsername = username.trim();
  const user = await UserRepository.findByUsername(cleanUsername);
  if (!user) return { ok: false, message: "Invalid username or password." };

  const hash = hashPassword(password, user.salt);
  if (!safeCompare(hash, user.passwordHash)) {
    return { ok: false, message: "Invalid username or password." };
  }

  return { ok: true, message: "Logged in.", user };
}

export async function getUser(username: string): Promise<DbUser | null> {
  return UserRepository.findByUsername(username);
}

export async function getUserById(id: string): Promise<DbUser | null> {
  return UserRepository.findById(id);
}

export async function createSession(userId: string, username: string): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  await SessionRepository.create(userId, username, token);
  return token;
}

export async function getSessionUser(token: string | undefined): Promise<string | null> {
  if (!token) return null;
  const session = await SessionRepository.findByToken(token);
  return session?.username ?? null;
}

export async function getSessionInfo(token: string | undefined) {
  if (!token) return null;
  return SessionRepository.findByToken(token);
}

export async function destroySession(token: string | undefined): Promise<void> {
  if (!token) return;
  await SessionRepository.delete(token);
}
