import { auth } from "@/auth"

export interface TokenPayload {
  userId: string
  username: string
}

export async function getCurrentUser(): Promise<TokenPayload | null> {
  const session = await auth()
  if (!session?.user) return null
  return {
    userId: session.user.id ?? "",
    username: session.user.name ?? "",
  }
}
