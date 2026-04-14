import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        username: { label: "帳號", type: "text" },
        password: { label: "密碼", type: "password" },
      },
      async authorize(credentials) {
        const username = credentials?.username as string | undefined
        const password = credentials?.password as string | undefined

        if (!username || !password) return null

        // 查找管理員
        let admin = await prisma.admin.findUnique({
          where: { username },
        })

        // 如果沒有任何管理員，自動將第一次登入註冊為管理員
        if (!admin) {
          const adminCount = await prisma.admin.count()
          if (adminCount === 0) {
            const hashedPassword = await bcrypt.hash(password, 10)
            admin = await prisma.admin.create({
              data: {
                username,
                password: hashedPassword,
              },
            })
          }
        }

        if (!admin) return null

        // 驗證密碼
        const isValid = await bcrypt.compare(password, admin.password)
        if (!isValid) return null

        return {
          id: admin.id,
          name: admin.username,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id
        token.username = user.name
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string
        session.user.name = token.username as string
      }
      return session
    },
  },
  pages: {
    signIn: "/admin/login",
  },
  session: {
    strategy: "jwt",
  },
})
