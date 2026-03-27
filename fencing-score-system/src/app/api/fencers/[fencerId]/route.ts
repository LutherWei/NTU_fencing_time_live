import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculatePouleStats } from '@/lib/fencing-math'

interface RouteParams {
  params: Promise<{ fencerId: string }>
}

// 獲取單一選手
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { fencerId } = await params

    const fencer = await prisma.fencer.findUnique({
      where: { id: fencerId },
      include: {
        category: true,
        poule: true
      }
    })

    if (!fencer) {
      return NextResponse.json(
        { success: false, error: '找不到該選手' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: fencer
    })
  } catch (error) {
    console.error('Get fencer error:', error)
    return NextResponse.json(
      { success: false, error: '獲取選手失敗' },
      { status: 500 }
    )
  }
}

// 更新選手
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { fencerId } = await params
    const data = await request.json()

    const fencer = await prisma.fencer.update({
      where: { id: fencerId },
      data
    })

    return NextResponse.json({
      success: true,
      data: fencer
    })
  } catch (error) {
    console.error('Update fencer error:', error)
    return NextResponse.json(
      { success: false, error: '更新選手失敗' },
      { status: 500 }
    )
  }
}

// 刪除選手
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { fencerId } = await params

    const fencerToDelete = await prisma.fencer.findUnique({
      where: { id: fencerId },
      include: {
        category: true
      }
    })

    if (!fencerToDelete) {
      return NextResponse.json({ success: false, error: '找不到該選手' }, { status: 404 })
    }

    // 若比賽已進入淘汰賽或已結束，鎖定名單不得再刪除選手
    if (fencerToDelete.category.status === 'elimination' || fencerToDelete.category.status === 'finished') {
      return NextResponse.json(
        { success: false, error: '比賽已進入淘汰賽階段或已結束，無法刪除選手' },
        { status: 400 }
      )
    }

    // 防呆：如果是在小組內，小組人數不得少於或剛好等於四個（被刪除後會少於四個）
    if (fencerToDelete.pouleId) {
      const pouleCheck = await prisma.poule.findUnique({
        where: { id: fencerToDelete.pouleId },
        include: { fencers: true }
      })
      if (pouleCheck && pouleCheck.fencers.length <= 4) {
        return NextResponse.json({ success: false, error: '刪除後小組人數少於四人，無法刪除' }, { status: 400 })
      }
    }

    // 刪除相關的 PouleMatch
    await prisma.pouleMatch.deleteMany({
      where: {
        OR: [
          { fencer1Id: fencerId },
          { fencer2Id: fencerId }
        ]
      }
    })

    await prisma.fencer.delete({
      where: { id: fencerId }
    })

    // 如果該選手已經在某個小組，重新計算小組內的統計
    if (fencerToDelete.pouleId) {
      const poule = await prisma.poule.findUnique({
        where: { id: fencerToDelete.pouleId },
        include: {
          fencers: true,
          matches: {
            where: { completed: true }
          }
        }
      })

      if (poule) {
        const remainingFencerIds = poule.fencers.map(f => f.id)
        const matchResults = poule.matches.map(m => ({
          fencer1Id: m.fencer1Id,
          fencer2Id: m.fencer2Id,
          score1: m.score1!,
          score2: m.score2!
        }))

        const stats = calculatePouleStats(remainingFencerIds, matchResults)

        for (const f of poule.fencers) {
          const stat = stats.get(f.id)
          if (stat) {
            await prisma.fencer.update({
              where: { id: f.id },
              data: {
                victories: stat.victories,
                defeats: stat.defeats,
                touchesScored: stat.touchesScored,
                touchesReceived: stat.touchesReceived,
                indicator: stat.indicator,
                winRate: stat.winRate
              }
            })
          }
        }
      }
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Delete fencer error:', error)
    return NextResponse.json(
      { success: false, error: '刪除選手失敗' },
      { status: 500 }
    )
  }
}
