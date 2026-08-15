import jwt from "jsonwebtoken";
import type { JwtPayload } from "../types/index.js";

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES ?? "30m";
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES ?? "30d";

export function signAccess(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_EXPIRES } as jwt.SignOptions);
}

export function signRefresh(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_EXPIRES } as jwt.SignOptions);
}

export function verifyAccess(token: string): JwtPayload {
  return jwt.verify(token, ACCESS_SECRET) as JwtPayload;
}

export function verifyRefresh(token: string): JwtPayload {
  return jwt.verify(token, REFRESH_SECRET) as JwtPayload;
}
