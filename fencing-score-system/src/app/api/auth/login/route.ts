import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { createToken, setAuthCookie } from '@/lib/auth'
import bcrypt from 'bcryptjs'

const DEFAULT_USERNAME = process.env.ADMIN_USERNAME
const DEFAULT_PASSWORD = process.env.ADMIN_PASSWORD

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json(
        { success: false, error: '請輸入帳號和密碼' },
        { status: 400 }
      )
    }

    // 查找管理員
    let admin = await prisma.admin.findUnique({
      where: { username }
    })

    // 如果沒有任何管理員，且使用預設帳密，創建預設管理員
    if (!admin) {
      const adminCount = await prisma.admin.count()
      if (adminCount === 0 && username === DEFAULT_USERNAME && password === DEFAULT_PASSWORD) {
        const hashedPassword = await bcrypt.hash(password, 10)
        admin = await prisma.admin.create({
          data: {
            username,
            password: hashedPassword
          }
        })
      }
    }

    if (!admin) {
      return NextResponse.json(
        { success: false, error: '帳號或密碼錯誤' },
        { status: 401 }
      )
    }

    // 驗證密碼
    const isValid = await bcrypt.compare(password, admin.password)
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: '帳號或密碼錯誤' },
        { status: 401 }
      )
    }

    // 創建 token
    const token = await createToken({
      userId: admin.id,
      username: admin.username
    })

    await setAuthCookie(token)

    return NextResponse.json({
      success: true,
      data: { username: admin.username }
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { success: false, error: '登入失敗' },
      { status: 500 }
    )
  }
}
