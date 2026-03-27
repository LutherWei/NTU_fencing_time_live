// TypeScript 型別定義

export type CategoryStatus = 'checkin' | 'poule' | 'elimination' | 'finished'

export interface Category {
  id: string
  name: string
  status: CategoryStatus
  createdAt: Date
  updatedAt: Date
}

export interface Fencer {
  id: string
  name: string
  checkedIn: boolean
  categoryId: string
  pouleId: string | null
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
  seedRank: number | null
  finalRank: number | null
}

export interface Poule {
  id: string
  name: string
  categoryId: string
  completed: boolean
  fencers: Fencer[]
}

export interface PouleMatch {
  id: string
  pouleId: string
  fencer1Id: string
  fencer2Id: string
  score1: number | null
  score2: number | null
  completed: boolean
}

export interface Bracket {
  id: string
  categoryId: string
  eliminationRate: number
  hasThirdPlace: boolean
  totalRounds: number
}

export interface EliminationMatch {
  id: string
  bracketId: string
  round: number
  position: number
  fencer1Id: string | null
  fencer2Id: string | null
  fencer1SeedRank: number | null
  fencer2SeedRank: number | null
  score1: number | null
  score2: number | null
  winnerId: string | null
  isBye: boolean
  isThirdPlace: boolean
  prevMatch1Id: string | null
  prevMatch2Id: string | null
  completed: boolean
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

// Auth types
export interface AuthUser {
  id: string
  username: string
}

export interface LoginRequest {
  username: string
  password: string
}

// Poule Matrix types
export interface PouleMatrixCell {
  rowFencerId: string
  colFencerId: string
  score: number | null
  isWinner: boolean | null
  isDiagonal: boolean
}

export interface PouleMatrix {
  pouleId: string
  fencers: Fencer[]
  cells: PouleMatrixCell[][]
}

// Ranking types
export interface FencerRanking extends Fencer {
  rank: number
}
