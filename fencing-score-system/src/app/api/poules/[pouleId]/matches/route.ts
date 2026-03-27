import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculatePouleStats } from '@/lib/fencing-math'

interface RouteParams {
  params: Promise<{ pouleId: string }>
}

// 獲取小組所有比賽
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { pouleId } = await params

    const matches = await prisma.pouleMatch.findMany({
      where: { pouleId },
      orderBy: [
        { fencer1Id: 'asc' },
        { fencer2Id: 'asc' }
      ]
    })

    return NextResponse.json({
      success: true,
      data: matches
    })
  } catch (error) {
    console.error('Get poule matches error:', error)
    return NextResponse.json(
      { success: false, error: '獲取比賽失敗' },
      { status: 500 }
    )
  }
}

// 更新比賽分數
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { pouleId } = await params
    const { matchId, score1, score2 } = await request.json()

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      return NextResponse.json(
        { success: false, error: '請輸入有效分數' },
        { status: 400 }
      )
    }

    // 檢查小組所屬組別目前是否仍在分組賽階段
    const pouleForStatus = await prisma.poule.findUnique({
      where: { id: pouleId },
      include: {
        category: true
      }
    })

    if (!pouleForStatus) {
      return NextResponse.json(
        { success: false, error: '找不到該小組' },
        { status: 404 }
      )
    }

    if (pouleForStatus.category.status !== 'poule') {
      return NextResponse.json(
        { success: false, error: '分組賽階段已結束，無法再修改小組賽成績' },
        { status: 400 }
      )
    }

    // 更新比賽分數
    const match = await prisma.pouleMatch.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        completed: true
      }
    })

    // 獲取該小組的所有比賽和選手，重新計算統計
    const poule = await prisma.poule.findUnique({
      where: { id: pouleId },
      include: {
        fencers: true,
        matches: {
          where: { completed: true }
        }
      }
    })

    if (poule) {
      const fencerIds = poule.fencers.map(f => f.id)
      const matchResults = poule.matches.map(m => ({
        fencer1Id: m.fencer1Id,
        fencer2Id: m.fencer2Id,
        score1: m.score1!,
        score2: m.score2!
      }))

      const stats = calculatePouleStats(fencerIds, matchResults)

      // 更新每位選手的統計
      for (const fencer of poule.fencers) {
        const stat = stats.get(fencer.id)
        if (stat) {
          await prisma.fencer.update({
            where: { id: fencer.id },
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

      // 檢查小組是否全部完成
      const totalMatches = (fencerIds.length * (fencerIds.length - 1)) / 2
      if (poule.matches.length >= totalMatches) {
        await prisma.poule.update({
          where: { id: pouleId },
          data: { completed: true }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: match
    })
  } catch (error) {
    console.error('Update match error:', error)
    return NextResponse.json(
      { success: false, error: '更新比賽失敗' },
      { status: 500 }
    )
  }
}
