import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ matchId: string }>
}

interface BoutWithCumScore {
  id: string
  order: number
  fencer1Id: string
  fencer2Id: string
  score1: number
  score2: number
  cumScore1: number
  cumScore2: number
}

function calculateCumulativeScores(bouts: any[]): BoutWithCumScore[] {
  let cumScore1 = 0
  let cumScore2 = 0
  
  return bouts.map(bout => {
    cumScore1 += bout.score1
    cumScore2 += bout.score2
    return {
      ...bout,
      cumScore1,
      cumScore2
    }
  })
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { matchId } = await params
    const url = new URL(request.url)
    const isPouleMatch = url.searchParams.get('isPouleMatch') === 'true'

    if (isPouleMatch) {
      // 從分組賽比賽獲取詳情 
      const pouleMatch = await prisma.pouleMatch.findUnique({
        where: { id: matchId },
        include: {
          detail: true,
          poule: {
            select: { teams: true }
          }
        }
      })

      if (!pouleMatch || !pouleMatch.team1Id || !pouleMatch.team2Id) {
        return NextResponse.json(
          { success: false, error: '找不到該比賽' },
          { status: 404 }
        )
      }

      // 如果 detail 不存在，自動創建
      let detail = pouleMatch.detail
      if (!detail) {
        detail = await prisma.teamMatchDetail.create({
          data: {
            pouleMatchId: matchId
          }
        })
      }

      // 獲取隊伍詳情
      const [team1, team2] = await Promise.all([
        prisma.team.findUnique({
          where: { id: pouleMatch.team1Id },
          include: { members: true }
        }),
        prisma.team.findUnique({
          where: { id: pouleMatch.team2Id },
          include: { members: true }
        })
      ])

      if (!team1 || !team2) {
        return NextResponse.json(
          { success: false, error: '找不到隊伍信息' },
          { status: 404 }
        )
      }

      // 獲取並排序 bouts
      const bouts = await prisma.teamBout.findMany({
        where: { matchDetailId: detail.id },
        orderBy: { order: 'asc' }
      })

      // 計算累積分數
      const boutsWithCumScore = calculateCumulativeScores(bouts)
      
      // 解析儲存的 setup 數據
      let setup = null
      if ((detail as any).setupData) {
        try {
          setup = JSON.parse((detail as any).setupData)
        } catch (e) {
          console.error('Failed to parse setup data:', e)
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          detail: {
            id: detail.id,
            bouts: boutsWithCumScore
          },
          setup,
          team1,
          team2
        }
      })
    } else {
      // 從淘汰賽比賽獲取詳情
      const eliminationMatch = await prisma.eliminationMatch.findUnique({
        where: { id: matchId },
        include: {
          detail: true,
          team1: {
            include: { members: true }
          },
          team2: {
            include: { members: true }
          }
        }
      })

      if (!eliminationMatch || !eliminationMatch.team1 || !eliminationMatch.team2) {
        return NextResponse.json(
          { success: false, error: '找不到該比賽' },
          { status: 404 }
        )
      }

      // 如果 detail 不存在，自動創建
      let detail = eliminationMatch.detail
      if (!detail) {
        detail = await prisma.teamMatchDetail.create({
          data: {
            eliminationMatchId: matchId
          }
        })
      }

      // 獲取並排序 bouts
      const bouts = await prisma.teamBout.findMany({
        where: { matchDetailId: detail.id },
        orderBy: { order: 'asc' }
      })

      // 計算累積分數
      const boutsWithCumScore = calculateCumulativeScores(bouts)
      
      // 解析儲存的 setup 數據
      let setup = null
      if ((detail as any).setupData) {
        try {
          setup = JSON.parse((detail as any).setupData)
        } catch (e) {
          console.error('Failed to parse setup data:', e)
        }
      }

      return NextResponse.json({
        success: true,
        data: {
          detail: {
            id: detail.id,
            bouts: boutsWithCumScore
          },
          setup,
          team1: eliminationMatch.team1,
          team2: eliminationMatch.team2
        }
      })
    }
  } catch (error) {
    console.error('Get match detail error:', error)
    return NextResponse.json(
      { success: false, error: '無法載入比賽詳情' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { matchId } = await params
    const { bouts } = await request.json()

    if (!Array.isArray(bouts)) {
      return NextResponse.json(
        { success: false, error: '比賽數據格式錯誤' },
        { status: 400 }
      )
    }

    // 查找對應的 TeamMatchDetail（可能來自分組賽或淘汰賽）
    let detail = await prisma.teamMatchDetail.findFirst({
      where: {
        OR: [
          { pouleMatchId: matchId },
          { eliminationMatchId: matchId }
        ]
      },
      include: { bouts: true }
    })

    if (!detail) {
      // 根據比賽 ID 確定是分組賽還是淘汰賽
      const pouleMatch = await prisma.pouleMatch.findUnique({ where: { id: matchId } })
      const eliminationMatch = await prisma.eliminationMatch.findUnique({ where: { id: matchId } })

      if (!pouleMatch && !eliminationMatch) {
        return NextResponse.json(
          { success: false, error: '找不到該比賽' },
          { status: 404 }
        )
      }

      // 創建新的 TeamMatchDetail
      detail = await prisma.teamMatchDetail.create({
        data: {
          pouleMatchId: pouleMatch ? matchId : undefined,
          eliminationMatchId: eliminationMatch ? matchId : undefined
        },
        include: { bouts: true }
      })
    }

    // 刪除舊的 bouts
    await prisma.teamBout.deleteMany({
      where: { matchDetailId: detail.id }
    })

    // 創建新的 bouts
    const newBouts = await Promise.all(
      bouts.map(bout =>
        prisma.teamBout.create({
          data: {
            matchDetailId: detail!.id,
            order: bout.order,
            fencer1Id: bout.fencer1Id,
            fencer2Id: bout.fencer2Id,
            score1: bout.score1,
            score2: bout.score2
          }
        })
      )
    )

    return NextResponse.json({
      success: true,
      data: { detail, bouts: newBouts }
    })
  } catch (error) {
    console.error('Post match detail error:', error)
    return NextResponse.json(
      { success: false, error: '無法儲存比賽詳情' },
      { status: 500 }
    )
  }
}
