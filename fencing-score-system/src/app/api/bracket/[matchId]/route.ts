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

    // 檢查所屬組別目前是否仍在淘汰賽階段
    const category = await prisma.category.findUnique({
      where: { id: match.bracket.categoryId },
      select: { status: true }
    })

    if (!category) {
      return NextResponse.json({ success: false, error: '找不到該組別' }, { status: 404 })
    }

    if (category.status !== 'elimination') {
      return NextResponse.json(
        { success: false, error: '淘汰賽階段已結束或尚未開始，無法修改淘汰賽成績' },
        { status: 400 }
      )
    }

    // 若本場已登錄成績，只要下一輪尚未開始仍允許修改；
    // 一旦下一輪（或三四名戰）有任何比分，就鎖定本場成績不得再改。
    let nextRoundStarted = false

    const nextRound = match.round / 2
    if (nextRound >= 1) {
      const nextPosition = Math.floor(match.position / 2)
      const nextMatch = await prisma.eliminationMatch.findFirst({
        where: {
          bracketId: match.bracketId,
          round: nextRound,
          position: nextPosition,
          isThirdPlace: false
        },
        select: {
          score1: true,
          score2: true,
          completed: true
        }
      })

      if (nextMatch && (nextMatch.completed || nextMatch.score1 !== null || nextMatch.score2 !== null)) {
        nextRoundStarted = true
      }
    }

    // 若是四強，另外檢查三四名戰是否已經開打
    let thirdPlaceStarted = false
    if (match.round === 2 && match.bracket.hasThirdPlace) {
      const thirdPlaceMatch = await prisma.eliminationMatch.findFirst({
        where: { bracketId: match.bracketId, isThirdPlace: true },
        select: {
          score1: true,
          score2: true,
          completed: true
        }
      })

      if (thirdPlaceMatch && (thirdPlaceMatch.completed || thirdPlaceMatch.score1 !== null || thirdPlaceMatch.score2 !== null)) {
        thirdPlaceStarted = true
      }
    }

    if (nextRoundStarted || thirdPlaceStarted) {
      return NextResponse.json(
        { success: false, error: '下一輪比賽已經開始，無法再修改本場成績' },
        { status: 400 }
      )
    }

    // 先記錄本場比賽開始前，兩位選手當下的 seedRank，作為此 match 的快照
    const fencer1SeedAtMatch = match.fencer1?.seedRank ?? null
    const fencer2SeedAtMatch = match.fencer2?.seedRank ?? null

    // 確定贏家與輸家
    const isFencer1Winner = score1 > score2
    const winnerId = isFencer1Winner ? match.fencer1Id : match.fencer2Id
    const loserId = isFencer1Winner ? match.fencer2Id : match.fencer1Id

    let calculatedLoserSeed: number | null = null
    let newWinnerSeed: number | null = null
    let newLoserSeed: number | null = null

    // 檢查並更新 seedRank
    if (match.fencer1 && match.fencer2 && match.fencer1.seedRank != null && match.fencer2.seedRank != null) {
      const winnerSeedRank = isFencer1Winner ? match.fencer1.seedRank : match.fencer2.seedRank
      const loserSeedRank = isFencer1Winner ? match.fencer2.seedRank : match.fencer1.seedRank
  
      newWinnerSeed = Math.min(winnerSeedRank, loserSeedRank) // 贏家取較好的種子
      newLoserSeed = Math.max(winnerSeedRank, loserSeedRank) // 輸家取較差的種子
      
      calculatedLoserSeed = newLoserSeed // 紀錄敗者應該拿到的 seedRank
      const winner = isFencer1Winner ? match.fencer1 : match.fencer2
      const loser = isFencer1Winner ? match.fencer2 : match.fencer1

      await prisma.fencer.update({
        where: { id: winner.id },
        data: { seedRank: newWinnerSeed }
      })
      await prisma.fencer.update({
        where: { id: loser.id },
        data: { seedRank: newLoserSeed }
      })
    }

    // 3. 更新當前比賽狀態
    const updatedMatch = await prisma.eliminationMatch.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        winnerId,
        completed: true,
        // 把本場比賽開打當下兩位選手的 seedRank 存成快照
        fencer1SeedRank: fencer1SeedAtMatch,
        fencer2SeedRank: fencer2SeedAtMatch
      }
    })

    // 4. 處理下一輪晉級推演
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
          data: isFirstFencer
            ? {
                fencer1Id: winnerId,
                // 把晉級到下一輪時的 seedRank 也一併記錄在下一場 match 上
                fencer1SeedRank: newWinnerSeed ?? undefined
              }
            : {
                fencer2Id: winnerId,
                fencer2SeedRank: newWinnerSeed ?? undefined
              }
        })
      }

      // 輸家打三四名戰
      if (match.round === 2 && loserId) {
        if (match.bracket.hasThirdPlace){
          const thirdPlaceMatch = await prisma.eliminationMatch.findFirst({
            where: { bracketId: match.bracketId, isThirdPlace: true }
          })

          if (thirdPlaceMatch) {
            const isFirst = match.position === 0
            await prisma.eliminationMatch.update({
              where: { id: thirdPlaceMatch.id },
              data: isFirst
                ? {
                    fencer1Id: loserId,
                    fencer1SeedRank: newLoserSeed ?? undefined
                  }
                : {
                    fencer2Id: loserId,
                    fencer2SeedRank: newLoserSeed ?? undefined
                  }
            })
          }
        }else{
          // 沒有三四名戰的話，直接把輸家 finalRank 設為 3
          await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 3 } })
        }
      }
    }

    // 5. 計算並寫入 Final Rank (最終名次)
    if (match.round === 1 && !match.isThirdPlace) { // 冠亞賽結束
      await prisma.fencer.update({ where: { id: winnerId! }, data: { finalRank: 1 } })
      if (loserId) await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 2 } })

      // 檢查是否可以將整個 Category 設為 finished
      if (!match.bracket.hasThirdPlace) {
        // 沒有三四名戰，直接結束
        await prisma.category.update({ where: { id: match.bracket.categoryId }, data: { status: 'finished' } })
      } else {
        // 有三四名戰，要檢查三四名戰是否也打完了
        const thirdPlaceMatch = await prisma.eliminationMatch.findFirst({
          where: { bracketId: match.bracketId, isThirdPlace: true },
          select: { completed: true }
        })
        if (thirdPlaceMatch?.completed) {
          await prisma.category.update({ where: { id: match.bracket.categoryId }, data: { status: 'finished' } })
        }
      }
      
    } else if (match.isThirdPlace) { // 三四名戰結束
      await prisma.fencer.update({ where: { id: winnerId! }, data: { finalRank: 3 } })
      if (loserId) await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 4 } })
      
      // 檢查冠亞賽是否也打完了
      const finalMatch = await prisma.eliminationMatch.findFirst({
        where: { bracketId: match.bracketId, round: 1, isThirdPlace: false },
        select: { completed: true }
      })
      if (finalMatch?.completed) {
        await prisma.category.update({ where: { id: match.bracket.categoryId }, data: { status: 'finished' } })
      }

    } else {
      // 一般淘汰賽敗者名次：根據同一階段所有被淘汰者的「小組賽成績」與「可用的seedRank(即淘汰者當下的seedRank)」重新排序分配
      const isPermanentlyEliminated = !(match.round === 2)
      if (isPermanentlyEliminated && loserId) {
        
        // 取得同一輪 (包含本場) 所有的已完賽結果
        const completedMatchesInRound = await prisma.eliminationMatch.findMany({
          where: {
            bracketId: match.bracketId,
            round: match.round,
            isThirdPlace: false,
            completed: true
          },
          include: {
            fencer1: true,
            fencer2: true
          }
        })

        // 整理所有本輪被淘汰的人，以及他們目前的 seedRank (即此輪配給到的 max(seed1, seed2))
        const losersInRound = completedMatchesInRound
          .filter(m => m.winnerId != null)
          .map(m => {
            const loser = m.winnerId === m.fencer1Id ? m.fencer2 : m.fencer1
            return loser
          })
          .filter((l): l is NonNullable<typeof l> => l !== null && l.seedRank !== null)

        // 收集所有本輪可用的 seedRank 名次（數字越小越好）
        const availableSlots = losersInRound.map(l => l.seedRank as number).sort((a, b) => a - b)

        // 依據初賽排名（pouleRank）排序所有本輪淘汰的輸家
        // 如果沒有 pouleRank（可能舊資料），則回退使用勝率及小分排序
        const sortedLosers = [...losersInRound].sort((a, b) => {
          if (a.pouleRank !== null && b.pouleRank !== null) {
            return a.pouleRank - b.pouleRank
          }

          if (a.winRate !== b.winRate) return b.winRate - a.winRate
          if (a.indicator !== b.indicator) return b.indicator - a.indicator
          const scoreDiff = (b.touchesScored || 0) - (a.touchesScored || 0)
          if (scoreDiff !== 0) return scoreDiff
          // 若成績完全相同，則加上 id 排序確保持穩定性
          return a.id.localeCompare(b.id)
        })

        // 將重新排序後名次較好（初賽表現較佳）的輸家，分配較小（較好）的 seedRank 與 finalRank
        for (let i = 0; i < sortedLosers.length; i++) {
          const fencerToUpdate = sortedLosers[i]
          const assignedFinalRank = availableSlots[i]
          if (assignedFinalRank != null) {
            await prisma.fencer.update({
              where: { id: fencerToUpdate.id },
              data: {
                seedRank: assignedFinalRank,
                finalRank: assignedFinalRank
              }
            })
          }
        }
      }
    }

    return NextResponse.json({ success: true, data: updatedMatch })

  } catch (error) {
    console.error('Update elimination match error:', error)
    return NextResponse.json({ success: false, error: '更新比賽失敗' }, { status: 500 })
  }
}