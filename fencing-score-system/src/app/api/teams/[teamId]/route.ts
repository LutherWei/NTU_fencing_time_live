import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// 刪除隊伍
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ teamId: string }> }
) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { teamId } = await params

    if (!teamId) {
      return NextResponse.json(
        { success: false, error: '缺少隊伍 ID' },
        { status: 400 }
      )
    }

    // 使用 transaction 刪除隊伍及其所有成員
    await prisma.$transaction(async (tx) => {
      // 刪除與該隊伍關聯的所有 Fencer
      await tx.fencer.deleteMany({
        where: { teamId: teamId },
      })

      // 刪除隊伍本身
      await tx.team.delete({
        where: { id: teamId },
      })
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete team error:', error)
    return NextResponse.json(
      { success: false, error: '刪除隊伍失敗' },
      { status: 500 }
    )
  }
}
