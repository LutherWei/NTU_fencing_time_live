// 擊劍計分相關演算法

export interface FencerStats {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number   // 得分 (TS)
  touchesReceived: number // 失分 (TR)
  indicator: number       // 淨得失分 (Ind = TS - TR)
  winRate: number         // 勝率
}

export interface PouleMatchResult {
  participant1Id: string
  participant2Id: string
  score1: number
  score2: number
}

/**
 * 計算小組賽得分矩陣的統計數據
 * @param participantIds 選手/隊伍ID陣列
 * @param matches 比賽結果
 * @returns 每位選手/隊伍的統計數據
 */
export function calculatePouleStats(
  participantIds: string[],
  matches: PouleMatchResult[]
): Map<string, Omit<FencerStats, 'id' | 'name'>> {
  const stats = new Map<string, Omit<FencerStats, 'id' | 'name'>>()
  
  // 初始化每位選手的統計
  for (const id of participantIds) {
    stats.set(id, {
      victories: 0,
      defeats: 0,
      touchesScored: 0,
      touchesReceived: 0,
      indicator: 0,
      winRate: 0
    })
  }
  
  // 處理每場比賽
  for (const match of matches) {
    const stat1 = stats.get(match.participant1Id)
    const stat2 = stats.get(match.participant2Id)
    
    if (!stat1 || !stat2) continue
    
    // 更新得失分
    stat1.touchesScored += match.score1
    stat1.touchesReceived += match.score2
    stat2.touchesScored += match.score2
    stat2.touchesReceived += match.score1
    
    // 更新勝敗場次
    if (match.score1 > match.score2) {
      stat1.victories += 1
      stat2.defeats += 1
    } else if (match.score2 > match.score1) {
      stat2.victories += 1
      stat1.defeats += 1
    }
    // 平局不計勝敗（擊劍比賽理論上不會有平局）
  }
  
  // 計算淨得失分和勝率
  for (const [id, stat] of stats) {
    stat.indicator = stat.touchesScored - stat.touchesReceived
    const totalMatches = stat.victories + stat.defeats
    stat.winRate = totalMatches > 0 ? stat.victories / totalMatches : 0
    stats.set(id, stat)
  }
  
  return stats
}

/**
 * 比較兩位選手的排名
 * 依序比較：勝率 > 淨得分 > 得分
 * @returns 負數表示a排名較前，正數表示b排名較前，0表示相同
 */
export function compareFencerRanking(a: FencerStats, b: FencerStats): number {
  // 1. 比較勝率（高的排前面）
  if (a.winRate !== b.winRate) {
    return b.winRate - a.winRate
  }
  
  // 2. 比較淨得分（高的排前面）
  if (a.indicator !== b.indicator) {
    return b.indicator - a.indicator
  }
  
  // 3. 比較得分（高的排前面）
  if (a.touchesScored !== b.touchesScored) {
    return b.touchesScored - a.touchesScored
  }
  
  // 4. 三項都相同，隨機決定（返回0將由排序演算法決定）
  return Math.random() - 0.5
}

/**
 * 對選手進行排名
 * @param fencers 選手統計資料陣列
 * @returns 排序後的選手陣列（索引+1即為排名）
 */
export function rankFencers(fencers: FencerStats[]): FencerStats[] {
  return [...fencers].sort(compareFencerRanking)
}

/**
 * 根據晉級人數計算需要從幾強打起
 * @param qualifiedCount 晉級人數
 * @returns 從幾強開始（必為2的冪次）
 */
export function calculateBracketSize(qualifiedCount: number): number {
  if (qualifiedCount <= 1) return 1
  // 計算 2^ceil(log2(n))
  return Math.pow(2, Math.ceil(Math.log2(qualifiedCount)))
}

/**
 * 計算淘汰後的晉級人數
 * @param totalFencers 總選手數
 * @param eliminationRate 淘汰比率（0-1）
 * @returns 晉級人數
 */
export function calculateQualifiedCount(totalFencers: number, eliminationRate: number): number {
  const qualified = Math.ceil(totalFencers * (1 - eliminationRate))
  // 確保至少有2人晉級
  return Math.max(2, qualified)
}

/**
 * 判斷分數是否為勝利（V）
 * 小組賽打5分，拿到5分的記為V
 */


/**
 * 格式化分數顯示
 * 5分顯示為V，其他顯示數字
 */
export function formatPouleScore(score: number, opponentScore: number): string {
  if (score > opponentScore) {
    return `V${score}`
  }
  return score.toString()
}

/**
 * 計算勝率顯示格式
 */
export function formatWinRate(winRate: number): string {
  return (winRate * 100).toFixed(1) + '%'
}

/**
 * 計算淨得失分顯示格式
 */
export function formatIndicator(indicator: number): string {
  if (indicator > 0) return `+${indicator}`
  return indicator.toString()
}
