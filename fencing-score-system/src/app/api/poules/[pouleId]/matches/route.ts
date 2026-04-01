import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

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
    const { matchId, score1, score2, isTeamMatch } = await request.json()

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      return NextResponse.json(
        { success: false, error: '請輸入有效分數' },
        { status: 400 }
      )
    }

    // 檢查小組所屬組別目前是否仍在分組賽階段
    const pouleForStatus = await prisma.poule.findUnique({
      where: { id: pouleId },
      include: { category: true } // 這裡不需要深度 include，減少資料庫負擔
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

    // 1. 更新這場比賽的分數
    const match = await prisma.pouleMatch.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        completed: true
      }
    })

    // 2. 獲取該小組的「所有比賽」，以此為基準進行統計
    const poule = await prisma.poule.findUnique({
      where: { id: pouleId },
      include: {
        matches: true // 抓出所有比賽（不論打完沒），確保能算對「總場次」
      }
    })

    if (poule) {
      const allMatches = poule.matches;
      const completedMatches = allMatches.filter(m => m.completed);

      if (isTeamMatch) {
        // 🌟 團體賽統計更新：直接從比賽中萃取絕對正確的隊伍 ID
        const teamIds = new Set<string>();
        allMatches.forEach(m => {
          if (m.team1Id) teamIds.add(m.team1Id);
          if (m.team2Id) teamIds.add(m.team2Id);
        });

        for (const tId of Array.from(teamIds)) {
          let V = 0, M = 0, TS = 0, TR = 0;
          
          completedMatches.forEach(m => {
            if (m.team1Id === tId || m.team2Id === tId) {
              M++;
              const myScore = m.team1Id === tId ? m.score1! : m.score2!;
              const opScore = m.team1Id === tId ? m.score2! : m.score1!;
              TS += myScore;
              TR += opScore;
              if (myScore > opScore) V++;
            }
          });

          await prisma.team.update({
            where: { id: tId },
            data: {
              victories: V,
              defeats: M - V,
              touchesScored: TS,
              touchesReceived: TR,
              indicator: TS - TR,
              winRate: M > 0 ? V / M : 0
            }
          });
        }

        // 檢查小組是否全部完成
        const totalMatches = (teamIds.size * (teamIds.size - 1)) / 2;
        if (completedMatches.length >= totalMatches && totalMatches > 0) {
          await prisma.poule.update({
            where: { id: pouleId },
            data: { completed: true }
          });
        }

      } else {
        // 🤺 個人賽統計更新：直接從比賽中萃取絕對正確的選手 ID
        const fencerIds = new Set<string>();
        allMatches.forEach(m => {
          if (m.fencer1Id) fencerIds.add(m.fencer1Id);
          if (m.fencer2Id) fencerIds.add(m.fencer2Id);
        });

        for (const fId of Array.from(fencerIds)) {
          let V = 0, M = 0, TS = 0, TR = 0;
          
          completedMatches.forEach(m => {
            if (m.fencer1Id === fId || m.fencer2Id === fId) {
              M++;
              const myScore = m.fencer1Id === fId ? m.score1! : m.score2!;
              const opScore = m.fencer1Id === fId ? m.score2! : m.score1!;
              TS += myScore;
              TR += opScore;
              if (myScore > opScore) V++;
            }
          });

          await prisma.fencer.update({
            where: { id: fId },
            data: {
              victories: V,
              defeats: M - V,
              touchesScored: TS,
              touchesReceived: TR,
              indicator: TS - TR,
              winRate: M > 0 ? V / M : 0
            }
          });
        }

        // 檢查小組是否全部完成
        const totalMatches = (fencerIds.size * (fencerIds.size - 1)) / 2;
        if (completedMatches.length >= totalMatches && totalMatches > 0) {
          await prisma.poule.update({
            where: { id: pouleId },
            data: { completed: true }
          });
        }
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