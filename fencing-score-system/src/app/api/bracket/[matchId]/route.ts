// 檔案位置：src/app/api/matches/[matchId]/route.ts

import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ matchId: string }>
}

// 更新淘汰賽比賽分數
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    // 驗證登入狀態
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })
    }

    const { matchId } = await params
    const { score1, score2 } = await request.json()

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      return NextResponse.json({ success: false, error: '請輸入有效分數' }, { status: 400 })
    }

    // 獲取比賽資訊
    const match = await prisma.eliminationMatch.findUnique({
      where: { id: matchId },
      include: { fencer1: true, fencer2: true, bracket: true }
    })

    if (!match) {
      return NextResponse.json({ success: false, error: '找不到該比賽' }, { status: 404 })
    }

    // 確定贏家與輸家
    const isFencer1Winner = score1 > score2
    const winnerId = isFencer1Winner ? match.fencer1Id : match.fencer2Id
    const loserId = isFencer1Winner ? match.fencer2Id : match.fencer1Id

    // 1. 取得兩人的原始種子序
    const originalWinnerSeed = isFencer1Winner ? match.fencer1?.seedRank : match.fencer2?.seedRank
    const originalLoserSeed = isFencer1Winner ? match.fencer2?.seedRank : match.fencer1?.seedRank

    // 2. 處理排名互換 (Upset Swap)
    if (originalWinnerSeed && originalLoserSeed) {
      if (originalWinnerSeed > originalLoserSeed) {
        await prisma.fencer.update({ where: { id: winnerId! }, data: { seedRank: originalLoserSeed } })
        await prisma.fencer.update({ where: { id: loserId! }, data: { seedRank: originalWinnerSeed } })
      }
    }

    // 3. 更新當前比賽狀態
    const updatedMatch = await prisma.eliminationMatch.update({
      where: { id: matchId },
      data: { score1, score2, winnerId, completed: true }
    })

    // 4. 處理下一輪晉級推演
    const nextRound = match.round / 2
    if (nextRound >= 1) {
      const nextPosition = Math.floor(match.position / 2)
      const isFirstFencer = match.position % 2 === 0

      // 贏家晉級
      const nextMatch = await prisma.eliminationMatch.findFirst({
        where: { bracketId: match.bracketId, round: nextRound, position: nextPosition, isThirdPlace: false }
      })

      if (nextMatch && winnerId) {
        await prisma.eliminationMatch.update({
          where: { id: nextMatch.id },
          data: isFirstFencer ? { fencer1Id: winnerId } : { fencer2Id: winnerId }
        })
      }

      // 輸家打三四名戰
      if (match.round === 2 && match.bracket.hasThirdPlace && loserId) {
        const thirdPlaceMatch = await prisma.eliminationMatch.findFirst({
          where: { bracketId: match.bracketId, isThirdPlace: true }
        })

        if (thirdPlaceMatch) {
          const isFirst = match.position === 0
          await prisma.eliminationMatch.update({
            where: { id: thirdPlaceMatch.id },
            data: isFirst ? { fencer1Id: loserId } : { fencer2Id: loserId }
          })
        }
      }
    }

    // 5. 計算並寫入 Final Rank (最終名次)
    if (match.round === 1 && !match.isThirdPlace) {
      await prisma.fencer.update({ where: { id: winnerId! }, data: { finalRank: 1 } })
      if (loserId) await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 2 } })
      await prisma.category.update({ where: { id: match.bracket.categoryId }, data: { status: 'finished' } })
      
    } else if (match.isThirdPlace) {
      await prisma.fencer.update({ where: { id: winnerId! }, data: { finalRank: 3 } })
      if (loserId) await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 4 } })
      
    } else {
      // 一般淘汰賽敗者名次：max(贏家的原始種子序, 輸家的原始種子序)
      const isPermanentlyEliminated = !(match.round === 2 && match.bracket.hasThirdPlace)
      if (isPermanentlyEliminated && loserId && originalWinnerSeed && originalLoserSeed) {
        const calculatedFinalRank = Math.max(originalWinnerSeed, originalLoserSeed)
        await prisma.fencer.update({
          where: { id: loserId },
          data: { finalRank: calculatedFinalRank }
        })
      }
    }

    return NextResponse.json({ success: true, data: updatedMatch })

  } catch (error) {
    console.error('Update elimination match error:', error)
    return NextResponse.json({ success: false, error: '更新比賽失敗' }, { status: 500 })
  }
}