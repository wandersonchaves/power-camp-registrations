import "next-auth";
import "next-auth/jwt";

type AppRole = "ADMIN" | "USER";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: AppRole;
      isActive: boolean;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    isActive: boolean;
    role: "ADMIN" | "USER";
    name?: string | null;
    email?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: AppRole;
    isActive?: boolean;
  }
}
