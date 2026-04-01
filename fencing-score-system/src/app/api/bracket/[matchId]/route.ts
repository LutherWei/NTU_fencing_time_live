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
    const { score1, score2, isTeamMatch } = await request.json()

    if (typeof score1 !== 'number' || typeof score2 !== 'number') {
      return NextResponse.json({ success: false, error: '請輸入有效分數' }, { status: 400 })
    }

    // 根據比賽類型決定要 include 的關聯
    const includeRelation = isTeamMatch 
      ? { team1: true, team2: true, bracket: true }
      : { fencer1: true, fencer2: true, bracket: true };

    // 獲取比賽資訊
    const match = await prisma.eliminationMatch.findUnique({
      where: { id: matchId },
      include: includeRelation
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

    const participant1 = isTeamMatch ? match.team1 : match.fencer1;
    const participant2 = isTeamMatch ? match.team2 : match.fencer2;
    const participant1Id = isTeamMatch ? match.team1Id : match.fencer1Id;
    const participant2Id = isTeamMatch ? match.team2Id : match.fencer2Id;

    // 先記錄本場比賽開始前，兩位選手/隊伍當下的 seedRank，作為此 match 的快照
    const participant1SeedAtMatch = participant1?.seedRank ?? null
    const participant2SeedAtMatch = participant2?.seedRank ?? null

    // 確定贏家與輸家
    const isParticipant1Winner = score1 > score2
    const winnerId = isParticipant1Winner ? participant1Id : participant2Id
    const loserId = isParticipant1Winner ? participant2Id : participant1Id

    let calculatedLoserSeed: number | null = null
    let newWinnerSeed: number | null = null
    let newLoserSeed: number | null = null

    // 檢查並更新 seedRank
    if (participant1 && participant2 && participant1.seedRank != null && participant2.seedRank != null) {
      const winnerSeedRank = isParticipant1Winner ? participant1.seedRank : participant2.seedRank
      const loserSeedRank = isParticipant1Winner ? participant2.seedRank : participant1.seedRank
  
      newWinnerSeed = Math.min(winnerSeedRank, loserSeedRank) // 贏家取較好的種子
      newLoserSeed = Math.max(winnerSeedRank, loserSeedRank) // 輸家取較差的種子
      
      calculatedLoserSeed = newLoserSeed // 紀錄敗者應該拿到的 seedRank
      const winner = isParticipant1Winner ? participant1 : participant2
      const loser = isParticipant1Winner ? participant2 : participant1

      if (isTeamMatch) {
        await prisma.team.update({
          where: { id: winner.id },
          data: { seedRank: newWinnerSeed }
        })
        await prisma.team.update({
          where: { id: loser.id },
          data: { seedRank: newLoserSeed }
        })
      } else {
        await prisma.fencer.update({
          where: { id: winner.id },
          data: { seedRank: newWinnerSeed }
        })
        await prisma.fencer.update({
          where: { id: loser.id },
          data: { seedRank: newLoserSeed }
        })
      }
    }

    // 3. 更新當前比賽狀態
    const updatedMatch = await prisma.eliminationMatch.update({
      where: { id: matchId },
      data: {
        score1,
        score2,
        winnerId: isTeamMatch ? undefined : winnerId,
        winnerTeamId: isTeamMatch ? winnerId : undefined,
        completed: true,
        // 把本場比賽開打當下兩位選手/隊伍的 seedRank 存成快照
        participant1SeedRank: participant1SeedAtMatch,
        participant2SeedRank: participant2SeedAtMatch
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
        const updateData = isFirstFencer
          ? {
              [isTeamMatch ? 'team1Id' : 'fencer1Id']: winnerId,
              participant1SeedRank: newWinnerSeed ?? undefined
            }
          : {
              [isTeamMatch ? 'team2Id' : 'fencer2Id']: winnerId,
              participant2SeedRank: newWinnerSeed ?? undefined
            };

        await prisma.eliminationMatch.update({
          where: { id: nextMatch.id },
          data: updateData
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
            const updateData = isFirst
              ? {
                  [isTeamMatch ? 'team1Id' : 'fencer1Id']: loserId,
                  participant1SeedRank: newLoserSeed ?? undefined
                }
              : {
                  [isTeamMatch ? 'team2Id' : 'fencer2Id']: loserId,
                  participant2SeedRank: newLoserSeed ?? undefined
                };
            await prisma.eliminationMatch.update({
              where: { id: thirdPlaceMatch.id },
              data: updateData
            })
          }
        }else{
          // 沒有三四名戰的話，直接把輸家 finalRank 設為 3
          if (isTeamMatch) {
            await prisma.team.update({ where: { id: loserId }, data: { finalRank: 3 } })
          } else {
            await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 3 } })
          }
        }
      }
    }

    // 5. 計算並寫入 Final Rank (最終名次)
    if (match.round === 1 && !match.isThirdPlace) { // 冠亞賽結束
      if (isTeamMatch) {
        await prisma.team.update({ where: { id: winnerId! }, data: { finalRank: 1 } })
        if (loserId) await prisma.team.update({ where: { id: loserId }, data: { finalRank: 2 } })
      } else {
        await prisma.fencer.update({ where: { id: winnerId! }, data: { finalRank: 1 } })
        if (loserId) await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 2 } })
      }

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
      if (isTeamMatch) {
        await prisma.team.update({ where: { id: winnerId! }, data: { finalRank: 3 } })
        if (loserId) await prisma.team.update({ where: { id: loserId }, data: { finalRank: 4 } })
      } else {
        await prisma.fencer.update({ where: { id: winnerId! }, data: { finalRank: 3 } })
        if (loserId) await prisma.fencer.update({ where: { id: loserId }, data: { finalRank: 4 } })
      }
      
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
          // 永遠載入所有可能的關聯，避免類型錯誤
          include: { 
            team1: true, 
            team2: true, 
            fencer1: true, 
            fencer2: true 
          }
        })

        // 整理所有本輪被淘汰的人，以及他們目前的 seedRank (即此輪配給到的 max(seed1, seed2))
        const losersInRound = completedMatchesInRound
          .filter(m => (isTeamMatch ? m.winnerTeamId : m.winnerId) != null)
          .map(m => {
            const winnerParticipantId = isTeamMatch ? m.winnerTeamId : m.winnerId;
            const loser = winnerParticipantId === (isTeamMatch ? m.team1Id : m.fencer1Id) 
              ? (isTeamMatch ? m.team2 : m.fencer2) // <--- 改為回傳完整的物件
              : (isTeamMatch ? m.team1 : m.fencer1); // <--- 改為回傳完整的物件
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
          const participantToUpdate = sortedLosers[i]
          const assignedFinalRank = availableSlots[i]
          if (assignedFinalRank != null) {
            if (isTeamMatch) {
              await prisma.team.update({
                where: { id: participantToUpdate.id },
                data: {
                  seedRank: assignedFinalRank,
                  finalRank: assignedFinalRank
                }
              })
            } else {
              await prisma.fencer.update({
                where: { id: participantToUpdate.id },
                data: {
                  seedRank: assignedFinalRank,
                  finalRank: assignedFinalRank
                }
              })
            }
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