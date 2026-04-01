import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { rankFencers, calculateQualifiedCount, calculateBracketSize, type FencerStats } from '@/lib/fencing-math'
import { generateBracket, calculateFinalRankings } from '@/lib/bracket-gen'

// 獲取某組別的淘汰賽
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

    // 獲取 category 以判斷比賽類型
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { competitionType: true }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: '找不到該組別' },
        { status: 404 }
      )
    }

    const isTeamMatch = category.competitionType === 'TEAM'

    const bracket = await prisma.bracket.findUnique({
      where: { categoryId },
      include: {
        matches: {
          include: {
            ...(isTeamMatch ? {
              team1: true,
              team2: true
            } : {
              fencer1: true,
              fencer2: true
            })
          },
          orderBy: [
            { round: 'desc' },
            { position: 'asc' }
          ]
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: bracket,
      isTeamMatch
    })
  } catch (error) {
    console.error('Get bracket error:', error)
    return NextResponse.json(
      { success: false, error: '獲取淘汰賽失敗' },
      { status: 500 }
    )
  }
}

// 創建淘汰賽
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { categoryId, eliminationRate, hasThirdPlace } = await request.json()

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: '請指定組別' },
        { status: 400 }
      )
    }

    // 若比賽已被標記為 finished，禁止重新建立淘汰賽
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { status: true }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: '找不到該組別' },
        { status: 404 }
      )
    }

    if (category.status === 'finished') {
      return NextResponse.json(
        { success: false, error: '比賽已結束，無法重新建立淘汰賽' },
        { status: 400 }
      )
    }

    // 獲取 category 以判斷比賽類型
    const categoryData = await prisma.category.findUnique({
      where: { id: categoryId },
      select: { competitionType: true }
    })

    if (!categoryData) {
      return NextResponse.json(
        { success: false, error: '找不到該組別' },
        { status: 404 }
      )
    }

    const isTeamMatch = categoryData.competitionType === 'TEAM'

    // 根據比賽類型查詢參賽者
    let participants: any[] = []
    if (isTeamMatch) {
      participants = await prisma.team.findMany({
        where: { categoryId },
        orderBy: [
          { winRate: 'desc' },
          { indicator: 'desc' },
          { touchesScored: 'desc' }
        ]
      })
    } else {
      participants = await prisma.fencer.findMany({
        where: { categoryId },
        orderBy: [
          { winRate: 'desc' },
          { indicator: 'desc' },
          { touchesScored: 'desc' }
        ]
      })
    }

    if (participants.length < 2) {
      return NextResponse.json(
        { success: false, error: `${isTeamMatch ? '隊伍' : '選手'}人數不足` },
        { status: 400 }
      )
    }

    // 計算排名
    const participantStats: FencerStats[] = participants.map(p => ({
      id: p.id,
      name: p.name,
      victories: p.victories,
      defeats: p.defeats,
      touchesScored: p.touchesScored,
      touchesReceived: p.touchesReceived,
      indicator: p.indicator,
      winRate: p.winRate
    }))

    const rankedParticipants = rankFencers(participantStats)

    // 計算晉級人數
    const qualifiedCount = calculateQualifiedCount(
      participants.length,
      eliminationRate ?? 0
    )
    const qualifiedParticipants = rankedParticipants.slice(0, qualifiedCount)

    // 更新參賽者種子排名與初賽排名
    for (let i = 0; i < rankedParticipants.length; i++) {
      const updateData = { 
        seedRank: i + 1,
        pouleRank: i + 1 
      }
      if (isTeamMatch) {
        await prisma.team.update({
          where: { id: rankedParticipants[i].id },
          data: updateData
        })
      } else {
        await prisma.fencer.update({
          where: { id: rankedParticipants[i].id },
          data: updateData
        })
      }
    }

    // 刪除現有淘汰賽（會級聯刪除所有比賽）
    const existingBracket = await prisma.bracket.findUnique({
      where: { categoryId }
    })
    
    if (existingBracket) {
      // 先明確刪除所有比賽
      await prisma.eliminationMatch.deleteMany({
        where: { bracketId: existingBracket.id }
      })
      // 再刪除 bracket
      await prisma.bracket.delete({
        where: { categoryId }
      })
    }

    // 生成淘汰賽架構
    const bracketSize = calculateBracketSize(qualifiedParticipants.length)
    const bracketMatches = generateBracket(
      qualifiedParticipants.map((p, i) => ({
        fencerId: isTeamMatch ? undefined : p.id,
        teamId: isTeamMatch ? p.id : undefined,
        seed: i + 1
      })),
      hasThirdPlace ?? false,
      isTeamMatch
    )

    // 驗證沒有重複的 (round, position) 組合
    const positionSet = new Set<string>()
    for (const match of bracketMatches) {
      const key = `${match.round}-${match.position}`
      if (positionSet.has(key)) {
        console.error('重複的比賽位置:', key, match)
        return NextResponse.json(
          { success: false, error: `重複的比賽位置: round ${match.round}, position ${match.position}` },
          { status: 500 }
        )
      }
      positionSet.add(key)
    }

    // 創建淘汰賽
    const bracket = await prisma.bracket.create({
      data: {
        categoryId,
        eliminationRate: eliminationRate ?? 0,
        hasThirdPlace: hasThirdPlace ?? false,
        totalRounds: Math.log2(bracketSize)
      }
    })

    // 創建所有比賽
    for (const match of bracketMatches) {
      const data: any = {
        bracketId: bracket.id,
        round: match.round,
        position: match.position,
        isBye: match.isBye,
        isThirdPlace: match.isThirdPlace,
        completed: match.isBye,
        participant1SeedRank: match.fencer1Seed,
        participant2SeedRank: match.fencer2Seed,
      }

      if (isTeamMatch) {
        data.team1Id = match.team1Id
        data.team2Id = match.team2Id
        data.winnerTeamId = match.isBye ? (match.team1Id || match.team2Id) : null
      } else {
        data.fencer1Id = match.fencer1Id
        data.fencer2Id = match.fencer2Id
        data.winnerId = match.isBye ? (match.fencer1Id || match.fencer2Id) : null
      }

      await prisma.eliminationMatch.create({ data })
    }

    // 更新組別狀態
    await prisma.category.update({
      where: { id: categoryId },
      data: { status: 'elimination' }
    })

    // 返回創建的淘汰賽
    const createdBracket = await prisma.bracket.findUnique({
      where: { id: bracket.id },
      include: {
        matches: {
          include: isTeamMatch ? {
            team1: true,
            team2: true
          } : {
            fencer1: true,
            fencer2: true
          },
          orderBy: [
            { round: 'desc' },
            { position: 'asc' }
          ]
        }
      }
    })

    return NextResponse.json({
      success: true,
      data: createdBracket,
      isTeamMatch
    })
  } catch (error) {
    console.error('Create bracket error:', error)
    return NextResponse.json(
      { success: false, error: '創建淘汰賽失敗' },
      { status: 500 }
    )
  }
}
