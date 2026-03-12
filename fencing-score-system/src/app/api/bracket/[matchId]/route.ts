import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ matchId: string }>
}

// 更新淘汰賽比賽分數
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { matchId } = await params
    const { score1, score2 } = await request.json()

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      return NextResponse.json(
        { success: false, error: '請輸入有效分數' },
        { status: 400 }
      )
    }

    // 獲取比賽資訊
    const match = await prisma.eliminationMatch.findUnique({
      where: { id: matchId },
      include: {
        fencer1: true,
        fencer2: true,
        bracket: true
      }
    })

    if (!match) {
      return NextResponse.json(
        { success: false, error: '找不到該比賽' },
        { status: 404 }
      )
    }

    // 確定贏家
    const winnerId = score1 > score2 ? match.fencer1Id : match.fencer2Id
    const loserId = score1 > score2 ? match.fencer2Id : match.fencer1Id

    // 檢查是否需要交換排名（低排名打贏高排名）
    if (match.fencer1 && match.fencer2 && match.fencer1.seedRank && match.fencer2.seedRank) {
      const winner = score1 > score2 ? match.fencer1 : match.fencer2
      const loser = score1 > score2 ? match.fencer2 : match.fencer1
      
      // 如果低排名（數字大）打贏高排名（數字小），交換排名
      if (winner.seedRank > loser.seedRank) {
        const tempRank = winner.seedRank
        await prisma.fencer.update({
          where: { id: winner.id },
          data: { seedRank: loser.seedRank }
        })
        await prisma.fencer.update({
          where: { id: loser.id },
          data: { seedRank: tempRank }
        })
      }
    }

    // 更新比賽
    const updatedMatch = await prisma.eliminationMatch.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        winnerId,
        completed: true
      }
    })

    // 找到下一場比賽（由這場比賽的贏家參加）
    // 這需要根據比賽的結構找到對應的下一輪比賽
    const nextRound = match.round / 2
    if (nextRound >= 1) {
      // 找出該比賽在下一輪對應的位置
      const nextPosition = Math.floor(match.position / 2)
      const isFirstFencer = match.position % 2 === 0

      const nextMatch = await prisma.eliminationMatch.findFirst({
        where: {
          bracketId: match.bracketId,
          round: nextRound,
          position: nextPosition,
          isThirdPlace: false
        }
      })

      if (nextMatch && winnerId) {
        // 將贏家放入下一場比賽
        await prisma.eliminationMatch.update({
          where: { id: nextMatch.id },
          data: isFirstFencer
            ? { fencer1Id: winnerId }
            : { fencer2Id: winnerId }
        })
      }

      // 如果是四強賽，且有三四名決定戰，將敗者放入三四名決定戰
      if (match.round === 2 && match.bracket.hasThirdPlace && loserId) {
        const thirdPlaceMatch = await prisma.eliminationMatch.findFirst({
          where: {
            bracketId: match.bracketId,
            isThirdPlace: true
          }
        })

        if (thirdPlaceMatch) {
          const isFirst = match.position === 0
          await prisma.eliminationMatch.update({
            where: { id: thirdPlaceMatch.id },
            data: isFirst
              ? { fencer1Id: loserId }
              : { fencer2Id: loserId }
          })
        }
      }
    }

    // 如果是決賽，更新選手最終排名
    if (match.round === 1 && !match.isThirdPlace) {
      await prisma.fencer.update({
        where: { id: winnerId! },
        data: { finalRank: 1 }
      })

      if (loserId) {
        await prisma.fencer.update({
          where: { id: loserId },
          data: { finalRank: 2 }
        })
      }

      // 更新組別狀態為已完成
      await prisma.category.update({
        where: { id: match.bracket.categoryId },
        data: { status: 'finished' }
      })
    }

    // 如果是三四名決定戰
    if (match.isThirdPlace) {
      await prisma.fencer.update({
        where: { id: winnerId! },
        data: { finalRank: 3 }
      })

      if (loserId) {
        await prisma.fencer.update({
          where: { id: loserId },
          data: { finalRank: 4 }
        })
      }
    }

    return NextResponse.json({
      success: true,
      data: updatedMatch
    })
  } catch (error) {
    console.error('Update elimination match error:', error)
    return NextResponse.json(
      { success: false, error: '更新比賽失敗' },
      { status: 500 }
    )
  }
}
