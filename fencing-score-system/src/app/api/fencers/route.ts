import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// 獲取所有選手（可按組別篩選）
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    const where = categoryId ? { categoryId } : {}

    const fencers = await prisma.fencer.findMany({
      where,
      include: {
        category: true,
        poule: true
      },
      orderBy: [
        { seedRank: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: fencers
    })
  } catch (error) {
    console.error('Get fencers error:', error)
    return NextResponse.json(
      { success: false, error: '獲取選手失敗' },
      { status: 500 }
    )
  }
}

// 創建新選手
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { name, categoryId } = await request.json()

    if (!name || !categoryId) {
      return NextResponse.json(
        { success: false, error: '請輸入選手名稱和組別' },
        { status: 400 }
      )
    }

    // 確認組別存在
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: '找不到該組別' },
        { status: 404 }
      )
    }

    const fencer = await prisma.fencer.create({
      data: {
        name: name.trim(),
        categoryId,
        checkedIn: true
      }
    })

    return NextResponse.json({
      success: true,
      data: fencer
    })
  } catch (error) {
    console.error('Create fencer error:', error)
    return NextResponse.json(
      { success: false, error: '創建選手失敗' },
      { status: 500 }
    )
  }
}
