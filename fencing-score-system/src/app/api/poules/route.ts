import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

// 獲取某組別的所有小組
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const categoryId = searchParams.get('categoryId')

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: '請指定組別' },
        { status: 400 }
      )
    }

    const poules = await prisma.poule.findMany({
      where: { categoryId },
      include: {
        fencers: {
          orderBy: { name: 'asc' }
        },
        matches: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json({
      success: true,
      data: poules
    })
  } catch (error) {
    console.error('Get poules error:', error)
    return NextResponse.json(
      { success: false, error: '獲取小組失敗' },
      { status: 500 }
    )
  }
}

// 創建小組分配
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { categoryId, poules } = await request.json()
    // poules: Array<{ name: string, fencerIds: string[] }>

    if (!categoryId || !poules || !Array.isArray(poules)) {
      return NextResponse.json(
        { success: false, error: '請提供有效的分組資料' },
        { status: 400 }
      )
    }

    // 驗證每組人數（4-8人）
    for (const poule of poules) {
      if (poule.fencerIds.length < 4 || poule.fencerIds.length > 8) {
        return NextResponse.json(
          { success: false, error: `小組 ${poule.name} 人數須為4-8人` },
          { status: 400 }
        )
      }
    }

    // 先刪除該組別現有的小組
    await prisma.poule.deleteMany({
      where: { categoryId }
    })

    // 創建新的小組
    const createdPoules = []
    for (const pouleData of poules) {
      const poule = await prisma.poule.create({
        data: {
          name: pouleData.name,
          categoryId,
          fencers: {
            connect: pouleData.fencerIds.map((id: string) => ({ id }))
          }
        },
        include: {
          fencers: true
        }
      })

      // 創建該小組的所有對戰（組合）
      const fencerIds = pouleData.fencerIds
      for (let i = 0; i < fencerIds.length; i++) {
        for (let j = i + 1; j < fencerIds.length; j++) {
          await prisma.pouleMatch.create({
            data: {
              pouleId: poule.id,
              fencer1Id: fencerIds[i],
              fencer2Id: fencerIds[j]
            }
          })
        }
      }

      createdPoules.push(poule)
    }

    // 更新組別狀態為分組賽
    await prisma.category.update({
      where: { id: categoryId },
      data: { status: 'poule' }
    })

    return NextResponse.json({
      success: true,
      data: createdPoules
    })
  } catch (error) {
    console.error('Create poules error:', error)
    return NextResponse.json(
      { success: false, error: '創建小組失敗' },
      { status: 500 }
    )
  }
}
