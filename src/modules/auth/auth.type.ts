export type SafeUser = {
  id: string;
  email: string;
  name: string | null;
  createdAt: Date;
};

export type AuthResult = {
  user: SafeUser;
  token: string;
};

export type JwtPayload = {
  userId: string;
};

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict" | "none";
  path: string;
  maxAge?: number;
};
