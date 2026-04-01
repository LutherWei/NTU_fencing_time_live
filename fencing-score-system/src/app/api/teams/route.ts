import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// 創建新隊伍
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { name, categoryId, members, substitute } = await request.json()

    if (!name || !categoryId || !Array.isArray(members) || members.length < 3) {
      return NextResponse.json(
        { success: false, error: '請提供完整的隊伍資訊' },
        { status: 400 }
      )
    }

    // 使用 transaction 確保資料一致性
    const newTeam = await prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: name.trim(),
          categoryId: categoryId,
        }
      })

      const memberData = members.map((memberName: string) => ({
        name: memberName.trim(),
        categoryId: categoryId,
        teamId: team.id,
        isSubstitute: false,
        checkedIn: true, // 報名時直接視為已報到
      }))

      if (substitute) {
        memberData.push({
          name: substitute.trim(),
          categoryId: categoryId,
          teamId: team.id,
          isSubstitute: true,
          checkedIn: true,
        })
      }

      await tx.fencer.createMany({
        data: memberData,
      })

      return team
    })

    return NextResponse.json({
      success: true,
      data: newTeam
    })
  } catch (error) {
    console.error('Create team error:', error)
    return NextResponse.json(
      { success: false, error: '創建隊伍失敗' },
      { status: 500 }
    )
  }
}
