import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteContext {
  params: Promise<{ categoryId: string }>
}

export async function POST(
  request: Request,
  context: RouteContext
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { categoryId } = await context.params

    // 檢查組別是否存在
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: '找不到該組別' },
        { status: 404 }
      )
    }

    // 刪除該組別的所有小組（會自動級聯刪除 matches）
    await prisma.poule.deleteMany({
      where: { categoryId }
    })

    // 重置所有選手的統計數據和 pouleId
    await prisma.fencer.updateMany({
      where: { categoryId },
      data: {
        pouleId: null,
        victories: 0,
        defeats: 0,
        touchesScored: 0,
        touchesReceived: 0,
        indicator: 0,
        winRate: 0,
        seedRank: null
      }
    })

    // 將組別狀態改回檢錄
    await prisma.category.update({
      where: { id: categoryId },
      data: { status: 'checkin' }
    })

    return NextResponse.json({
      success: true,
      message: '已重置分組'
    })
  } catch (error) {
    console.error('Reset poules error:', error)
    return NextResponse.json(
      { success: false, error: '重置分組失敗' },
      { status: 500 }
    )
  }
}
