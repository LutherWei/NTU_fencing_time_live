// 淘汰賽樹狀圖生成演算法

export interface BracketMatch {
  id: string
  round: number      // 1=決賽, 2=四強, 4=八強, 8=十六強...
  position: number   // 該輪中的位置 (0-indexed)
  fencer1Id: string | null
  fencer2Id: string | null
  fencer1Seed: number | null
  fencer2Seed: number | null
  score1: number | null
  score2: number | null
  winnerId: string | null
  completed: boolean
  isBye: boolean
  isThirdPlace: boolean
  prevMatch1Id: string | null  // 上一輪的比賽1（產生fencer1）
  prevMatch2Id: string | null  // 上一輪的比賽2（產生fencer2）
}

export interface SeedInfo {
  fencerId: string
  seed: number
}

/**
 * 生成最大亂度的對戰順序
 * 確保第x強的比賽都是由排名第 x+1-y 的選手對上排名 y 的選手
 * 
 * 例如：8人淘汰賽的對戰順序
 * 1 vs 8, 4 vs 5, 3 vs 6, 2 vs 7
 * 
 * @param bracketSize 淘汰賽規模（必為2的冪次）
 * @returns 對戰配對陣列，每個元素是 [高種子, 低種子]
 */
export function generateMaximumEntropy(bracketSize: number): [number, number][] {
  if (bracketSize < 2) return []
  
  // 使用遞迴方式生成最大亂度配對
  const seeds: number[] = []
  
  function buildSeeds(size: number, base: number = 1): number[] {
    if (size === 1) return [base]
    
    const half = size / 2
    const upper = buildSeeds(half, base)
    const lower: number[] = []
    
    for (const s of upper) {
      lower.push(size + 1 - s)
    }
    
    // 交錯合併
    const result: number[] = []
    for (let i = 0; i < half; i++) {
      if(half >= 2){
        if(i % 2 === 0){
          result.push(upper[i], lower[i])
        } else {
          result.push(lower[i], upper[i])
        }
      }
      else result.push(upper[i], lower[i])
    }
    return result
  }
  
  const orderedSeeds = buildSeeds(bracketSize)
  
  // 將種子序列轉換為配對
  const matches: [number, number][] = []
  for (let i = 0; i < orderedSeeds.length; i += 2) {
    const seed1 = orderedSeeds[i]
    const seed2 = orderedSeeds[i + 1]
    matches.push([seed1, seed2])
  }
  
  return matches
}

/**
 * 生成完整的淘汰賽樹狀結構
 * @param fencers 晉級選手（已按種子排序）
 * @param hasThirdPlace 是否有三四名決定戰
 * @returns 所有比賽的結構
 */
export function generateBracket(
  fencers: SeedInfo[],
  hasThirdPlace: boolean = false
): BracketMatch[] {
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(fencers.length)))
  const totalRounds = Math.log2(bracketSize)
  const matches: BracketMatch[] = []
  
  // 生成第一輪的配對（最大亂度）
  const firstRoundPairings = generateMaximumEntropy(bracketSize)
  
  // 建立種子到選手的映射
  const seedToFencer = new Map<number, SeedInfo>()
  fencers.forEach((f, index) => {
    seedToFencer.set(index + 1, f)
  })
  
  let matchId = 0
  
  // 生成第一輪比賽
  const firstRoundSize = bracketSize / 2  // 第一輪的比賽場數 = 參賽人數 / 2
  for (let pos = 0; pos < firstRoundSize; pos++) {
    const [seed1, seed2] = firstRoundPairings[pos]
    const fencer1 = seedToFencer.get(seed1)
    const fencer2 = seedToFencer.get(seed2)
    
    const isBye = !fencer1 || !fencer2
    
    matches.push({
      id: `match-${matchId++}`,
      round: firstRoundSize,  // 修正：第一輪的場數（例如 8人→4場，round=4）
      position: pos,
      fencer1Id: fencer1?.fencerId || null,
      fencer2Id: fencer2?.fencerId || null,
      fencer1Seed: fencer1 ? seed1 : null,
      fencer2Seed: fencer2 ? seed2 : null,
      score1: null,
      score2: null,
      winnerId: isBye ? (fencer1?.fencerId || fencer2?.fencerId || null) : null,
      completed: isBye,
      isBye,
      isThirdPlace: false,
      prevMatch1Id: null,
      prevMatch2Id: null
    })
  }
  
  // 生成後續輪次
  let prevRoundStart = 0
  let prevRoundSize = firstRoundSize
  let currentRound = firstRoundSize / 2  // 第二輪開始（第一輪已經生成了）
  
  while (currentRound >= 1) {
    const currentRoundSize = currentRound / 2 || 1
    
    if (currentRound === 1) {
      // 決賽
      const prevMatch1 = matches[prevRoundStart]
      const prevMatch2 = matches[prevRoundStart + 1]
      
      // 檢查前一輪比賽是否已完成，如果是就直接晉級
      const fencer1Id = prevMatch1?.completed && prevMatch1.winnerId ? prevMatch1.winnerId : null
      const fencer2Id = prevMatch2?.completed && prevMatch2.winnerId ? prevMatch2.winnerId : null
      
      matches.push({
        id: `match-${matchId++}`,
        round: 1,
        position: 0,
        fencer1Id,
        fencer2Id,
        fencer1Seed: null,
        fencer2Seed: null,
        score1: null,
        score2: null,
        winnerId: null,
        completed: false,
        isBye: false,
        isThirdPlace: false,
        prevMatch1Id: prevMatch1?.id || null,
        prevMatch2Id: prevMatch2?.id || null
      })
      break
    }
    
    // 生成當前輪的所有比賽（currentRound 場）
    for (let pos = 0; pos < currentRound; pos++) {
      const prevMatch1Idx = prevRoundStart + pos * 2
      const prevMatch2Idx = prevRoundStart + pos * 2 + 1
      
      const prevMatch1 = matches[prevMatch1Idx]
      const prevMatch2 = matches[prevMatch2Idx]
      
      // 檢查前一輪比賽是否已完成（Bye），如果是就直接晉級
      const fencer1Id = prevMatch1?.completed && prevMatch1.winnerId ? prevMatch1.winnerId : null
      const fencer2Id = prevMatch2?.completed && prevMatch2.winnerId ? prevMatch2.winnerId : null
      
      matches.push({
        id: `match-${matchId++}`,
        round: currentRound,
        position: pos,
        fencer1Id,
        fencer2Id,
        fencer1Seed: null,
        fencer2Seed: null,
        score1: null,
        score2: null,
        winnerId: null,
        completed: false,
        isBye: false,
        isThirdPlace: false,
        prevMatch1Id: prevMatch1?.id || null,
        prevMatch2Id: prevMatch2?.id || null
      })
    }
    
    prevRoundStart += prevRoundSize
    prevRoundSize = currentRound
    currentRound = currentRound / 2
  }
  
  // 如果需要三四名決定戰
  if (hasThirdPlace && bracketSize >= 4) {
    // 三四名決定戰的選手來自四強賽的敗者
    // 找到四強賽的比賽
    const semifinalMatches = matches.filter(m => m.round === 2)
    
    if (semifinalMatches.length === 2) {
      matches.push({
        id: `match-${matchId++}`,
        round: 1,
        position: 1,  // position 1 表示三四名決定戰
        fencer1Id: null,
        fencer2Id: null,
        fencer1Seed: null,
        fencer2Seed: null,
        score1: null,
        score2: null,
        winnerId: null,
        completed: false,
        isBye: false,
        isThirdPlace: true,
        prevMatch1Id: semifinalMatches[0].id,
        prevMatch2Id: semifinalMatches[1].id
      })
    }
  }
  
  return matches
}

/**
 * 獲取輪次名稱
 * round 代表該輪的比賽場數，round * 2 = 該輪參賽人數
 * 例如：round = 4 代表 4 場比賽，共 8 人參賽，稱為「八強」
 */
export function getRoundName(round: number, isThirdPlace: boolean = false): string {
  if (isThirdPlace) return '三四名決定戰'
  
  const playerCount = round * 2
  
  switch (playerCount) {
    case 2: return '決賽'
    case 4: return '四強'
    case 8: return '八強'
    case 16: return '十六強'
    case 32: return '三十二強'
    case 64: return '六十四強'
    default: return `${playerCount}強`
  }
}

/**
 * 計算選手在淘汰賽的最終排名
 * @param bracketMatches 所有淘汰賽比賽
 * @param fencerCount 總選手數
 * @returns Map<fencerId, finalRank>
 */
export function calculateFinalRankings(
  bracketMatches: BracketMatch[],
  fencerCount: number,
  hasThirdPlace: boolean
): Map<string, number> {
  const rankings = new Map<string, number>()
  
  // 找到決賽
  const final = bracketMatches.find(m => m.round === 1 && !m.isThirdPlace)
  
  if (final?.winnerId) {
    rankings.set(final.winnerId, 1)
    
    // 亞軍
    const runnerId = final.fencer1Id === final.winnerId ? final.fencer2Id : final.fencer1Id
    if (runnerId) {
      rankings.set(runnerId, 2)
    }
  }
  
  // 如果有三四名決定戰
  if (hasThirdPlace) {
    const thirdPlaceMatch = bracketMatches.find(m => m.isThirdPlace)
    if (thirdPlaceMatch?.winnerId) {
      rankings.set(thirdPlaceMatch.winnerId, 3)
      const fourthId = thirdPlaceMatch.fencer1Id === thirdPlaceMatch.winnerId 
        ? thirdPlaceMatch.fencer2Id 
        : thirdPlaceMatch.fencer1Id
      if (fourthId) {
        rankings.set(fourthId, 4)
      }
    }
  }
  
  // 其餘選手根據被淘汰的輪次決定排名
  // 在某輪被淘汰的選手，排名為 該輪開始位置+1 到 下一輪開始位置
  // ... 前面的決賽與三四名邏輯保持不變 ...

  const rounds = [...new Set(bracketMatches.map(m => m.round))].sort((a, b) => a - b)
  
  for (const round of rounds) {
    if (round === 1) continue // 決賽單獨處理
    
    const roundMatches = bracketMatches.filter(m => m.round === round && !m.isThirdPlace)
    
    // 修正：除了收集 ID，還要收集他們的種子序，以便後續排序
    const eliminatedFencersWithSeed: { id: string, seed: number }[] = []
    
    for (const match of roundMatches) {
      if (match.completed && match.winnerId) {
        // 判斷輸家是誰
        const isFencer1Loser = match.fencer1Id !== match.winnerId
        const loserId = isFencer1Loser ? match.fencer1Id : match.fencer2Id
        const loserSeed = isFencer1Loser ? match.fencer1Seed : match.fencer2Seed
        
        if (loserId && !rankings.has(loserId)) {
          eliminatedFencersWithSeed.push({
            id: loserId,
            seed: loserSeed || 999 // 如果沒有種子序給個極大值防呆
          })
        }
      }
    }
    
    // 修正擊劍邏輯：同一輪被淘汰者，依照種子序決定最終名次 (種子數字越小，名次越前面)
    eliminatedFencersWithSeed.sort((a, b) => a.seed - b.seed)
    
    // 修正數學算式：round 代表比賽場數，所以 baseRank 就是 round + 1
    const baseRank = round + 1
    
    eliminatedFencersWithSeed.forEach((fencer, idx) => {
      if (!rankings.has(fencer.id)) {
        // 依序給予名次：例如 baseRank=5，四個人分別拿到 5, 6, 7, 8
        rankings.set(fencer.id, baseRank + idx)
      }
    })
  }
  
  return rankings
}
