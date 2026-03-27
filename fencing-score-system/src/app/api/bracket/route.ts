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

    const bracket = await prisma.bracket.findUnique({
      where: { categoryId },
      include: {
        matches: {
          include: {
            fencer1: true,
            fencer2: true,
            winner: true
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
      data: bracket
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

    // 獲取該組別所有已完成分組賽的選手
    const fencers = await prisma.fencer.findMany({
      where: { categoryId },
      orderBy: [
        { winRate: 'desc' },
        { indicator: 'desc' },
        { touchesScored: 'desc' }
      ]
    })

    if (fencers.length < 2) {
      return NextResponse.json(
        { success: false, error: '選手人數不足' },
        { status: 400 }
      )
    }

    // 計算排名
    const fencerStats: FencerStats[] = fencers.map(f => ({
      id: f.id,
      name: f.name,
      victories: f.victories,
      defeats: f.defeats,
      touchesScored: f.touchesScored,
      touchesReceived: f.touchesReceived,
      indicator: f.indicator,
      winRate: f.winRate
    }))

    const rankedFencers = rankFencers(fencerStats)

    // 計算晉級人數
    const qualifiedCount = calculateQualifiedCount(
      fencers.length,
      eliminationRate ?? 0
    )
    const qualifiedFencers = rankedFencers.slice(0, qualifiedCount)

    // 更新選手種子排名與初賽排名
    for (let i = 0; i < rankedFencers.length; i++) {
      await prisma.fencer.update({
        where: { id: rankedFencers[i].id },
        data: { 
          seedRank: i + 1,
          pouleRank: i + 1 
        }
      })
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
    const bracketSize = calculateBracketSize(qualifiedFencers.length)
    const bracketMatches = generateBracket(
      qualifiedFencers.map((f, i) => ({ fencerId: f.id, seed: i + 1 })),
      hasThirdPlace ?? false
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
      await prisma.eliminationMatch.create({
        data: {
          bracketId: bracket.id,
          round: match.round,
          position: match.position,
          fencer1Id: match.fencer1Id,
          fencer2Id: match.fencer2Id,
          isBye: match.isBye,
          isThirdPlace: match.isThirdPlace,
          winnerId: match.isBye ? (match.fencer1Id || match.fencer2Id) : null,
          completed: match.isBye,
          fencer1SeedRank: match.fencer1Seed,
          fencer2SeedRank: match.fencer2Seed,
        }
      })
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
          include: {
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
      data: createdBracket
    })
  } catch (error) {
    console.error('Create bracket error:', error)
    return NextResponse.json(
      { success: false, error: '創建淘汰賽失敗' },
      { status: 500 }
    )
  }
}
