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
      eliminationRate ?? 0.25
    )
    const qualifiedFencers = rankedFencers.slice(0, qualifiedCount)

    // 更新選手種子排名
    for (let i = 0; i < rankedFencers.length; i++) {
      await prisma.fencer.update({
        where: { id: rankedFencers[i].id },
        data: { seedRank: i + 1 }
      })
    }

    // 刪除現有淘汰賽
    await prisma.bracket.deleteMany({
      where: { categoryId }
    })

    // 生成淘汰賽架構
    const bracketSize = calculateBracketSize(qualifiedFencers.length)
    const bracketMatches = generateBracket(
      qualifiedFencers.map((f, i) => ({ fencerId: f.id, seed: i + 1 })),
      hasThirdPlace ?? false
    )

    // 創建淘汰賽
    const bracket = await prisma.bracket.create({
      data: {
        categoryId,
        eliminationRate: eliminationRate ?? 0.25,
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
          completed: match.isBye
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
