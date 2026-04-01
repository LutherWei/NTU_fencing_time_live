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
        teams: {
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
    // poules: Array<{ name: string, fencerIds?: string[], teamIds?: string[] }>

    if (!categoryId || !poules || !Array.isArray(poules)) {
      return NextResponse.json(
        { success: false, error: '請提供有效的分組資料' },
        { status: 400 }
      )
    }

    // 獲取 category 看看是否為團體賽
    const category = await prisma.category.findUnique({
      where: { id: categoryId }
    })
    
    if (!category) {
      return NextResponse.json(
        { success: false, error: '找不到組別' },
        { status: 404 }
      )
    }
    
    const isTeam = category.competitionType === 'TEAM'
    const unitName = isTeam ? '隊' : '人'
    const lowerbound = isTeam ? 3:4

    // 驗證每組人數（4-8人/隊）
    for (const poule of poules) {
      const items = isTeam ? poule.teamIds : poule.fencerIds
      if (!items || items.length < lowerbound || items.length > 8) {
        return NextResponse.json(
          { success: false, error: `小組 ${poule.name} 數量須為${lowerbound}-8${unitName}` },
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
      const items = isTeam ? pouleData.teamIds : pouleData.fencerIds
      
      const createData = isTeam
        ? {
            name: pouleData.name,
            categoryId,
            teams: { connect: items.map((id: string) => ({ id })) }
          }
        : {
            name: pouleData.name,
            categoryId,
            fencers: { connect: items.map((id: string) => ({ id })) }
          };

      const poule = await prisma.poule.create({
        data: createData,
        include: {
          fencers: true,
          teams: true
        }
      })

      // 創建該小組的所有對戰（組合）
      for (let i = 0; i < items.length; i++) {
        for (let j = i + 1; j < items.length; j++) {
          const matchData = isTeam
            ? {
                pouleId: poule.id,
                team1Id: items[i],
                team2Id: items[j]
              }
            : {
                pouleId: poule.id,
                fencer1Id: items[i],
                fencer2Id: items[j]
              };
          
          await prisma.pouleMatch.create({
            data: matchData
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
