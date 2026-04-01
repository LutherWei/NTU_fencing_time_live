import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

export const dynamic = 'force-dynamic'

// 獲取所有組別
export async function GET() {
  try {
    const categories = await prisma.category.findMany({
      include: {
        fencers: true,
        teams: {
          include: {
            members: true
          }
        },
        _count: {
          select: { fencers: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: categories
    })
  } catch (error) {
    console.error('Get categories error:', error)
    return NextResponse.json(
      { success: false, error: '獲取組別失敗' },
      { status: 500 }
    )
  }
}

// 創建新組別
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { name, competitionType } = await request.json()

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: '請輸入組別名稱' },
        { status: 400 }
      )
    }

    const category = await prisma.category.create({
      data: { 
        name: name.trim(),
        competitionType: competitionType || 'INDIVIDUAL'
      }
    })

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Create category error:', error)
    return NextResponse.json(
      { success: false, error: '創建組別失敗' },
      { status: 500 }
    )
  }
}
