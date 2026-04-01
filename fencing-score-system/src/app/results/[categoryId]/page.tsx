'use client'

import { useEffect, useState, use } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PouleMatrix } from '@/components/poules/PouleMatrix'
import { BracketTree } from '@/components/bracket/BracketTree'
import { formatIndicator, formatWinRate, calculateQualifiedCount } from '@/lib/fencing-math'
import { ArrowLeft, Trophy, Users, Award } from 'lucide-react'
import Link from 'next/link'
import type { EliminationMatch } from '@/components/bracket/MatchNode'

interface Fencer {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
  seedRank: number | null
  finalRank: number | null
  pouleRank: number | null
  teamId?: string | null
}

interface Team {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
  seedRank: number | null
  finalRank: number | null
  pouleRank: number | null
}

interface PouleMatch {
  id: string
  // 個人賽欄位
  fencer1Id: string | null
  fencer2Id: string | null
  // 團體賽欄位（後端原始）
  team1Id: string | null
  team2Id: string | null
  score1: number | null
  score2: number | null
  completed: boolean
}

interface Poule {
  id: string
  name: string
  fencers: Fencer[]
  teams?: Team[]
  matches: PouleMatch[]
  completed: boolean
}

interface Bracket {
  id: string
  matches: EliminationMatch[]
  hasThirdPlace: boolean
  eliminationRate: number
}

interface Category {
  id: string
  name: string
  status: string
  competitionType: 'INDIVIDUAL' | 'TEAM'
  fencers: Fencer[]
  teams?: Team[]
  poules: Poule[]
  bracket: Bracket | null
}

const statusLabels: Record<string, { label: string; color: string }> = {
  checkin:     { label: '檢錄中', color: 'bg-yellow-100 text-yellow-800' },
  poule:       { label: '分組賽', color: 'bg-red-100 text-red-800' },
  elimination: { label: '淘汰賽', color: 'bg-purple-100 text-purple-800' },
  finished:    { label: '已結束', color: 'bg-green-100 text-green-800' },
}

interface PageProps {
  params: Promise<{ categoryId: string }>
}

export default function ResultsPage({ params }: PageProps) {
  const { categoryId } = use(params)
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'poules' | 'bracket' | 'rankings'>('poules')

  useEffect(() => {
    fetchCategory()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId])

  const fetchCategory = async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`)
      const data = await res.json()
      if (data.success) {
        const categoryData: Category = data.data

        if (categoryData.competitionType === 'TEAM') {
          categoryData.poules = (categoryData.poules || []).map((poule: Poule) => {
            // 把 team1Id/team2Id 正規化成 PouleMatrix 看得懂的 fencer1Id/fencer2Id
            //    PouleMatrix 以 participant.id 做交叉比對，所以只要把欄位名稱對齊即可
            const normalizedMatches: PouleMatch[] = (poule.matches || []).map(m => ({
              ...m,
              fencer1Id: m.team1Id,   // 讓 PouleMatrix 的 fencer1Id 欄讀到 team1Id
              fencer2Id: m.team2Id,   // 讓 PouleMatrix 的 fencer2Id 欄讀到 team2Id
            }))

            return {
              ...poule,
              matches: normalizedMatches,
            }
          })
        }

        setCategory(categoryData)

        if (
          (categoryData.status === 'elimination' || categoryData.status === 'finished') &&
          activeTab === 'poules' &&
          categoryData.bracket
        ) {
          setActiveTab('bracket')
        }
      }
    } catch (error) {
      console.error('Fetch category error:', error)
    } finally {
      setLoading(false)
    }
  }

  const getParticipants = () => {
    if (!category) return []
    return category.competitionType === 'TEAM'
      ? (category.teams || [])
      : (category.fencers || [])
  }

  const getPouleRankings = () => {
    const participants = getParticipants()
    return [...participants].sort((a, b) => {
      if (a.pouleRank !== null && b.pouleRank !== null && a.pouleRank !== b.pouleRank)
        return a.pouleRank - b.pouleRank
      if (a.winRate !== b.winRate) return b.winRate - a.winRate
      if (a.indicator !== b.indicator) return b.indicator - a.indicator
      const scoreDiff = b.touchesScored - a.touchesScored
      if (scoreDiff !== 0) return scoreDiff
      return a.id.localeCompare(b.id)
    })
  }

  const getFinalRankings = () => {
    const participants = getParticipants()
    return [...participants].sort((a, b) => {
      if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank
      if (a.finalRank) return -1
      if (b.finalRank) return 1
      if (a.seedRank && b.seedRank) return a.seedRank - b.seedRank
      return 0
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mx-auto" />
          <p className="mt-4 text-gray-600">載入中...</p>
        </div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-8">
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium text-gray-900">找不到該組別</h3>
              <Link href="/" className="text-red-700 hover:underline mt-2 inline-block">返回首頁</Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const rankings = getFinalRankings()
  const pouleRankings = getPouleRankings()
  const participantCount = getParticipants().length
  const eliminationRate = category.bracket?.eliminationRate ?? 0
  const qualifiedCount = calculateQualifiedCount(participantCount, eliminationRate)

  const formattedMatches = category.bracket?.matches.map((match: any) => {
    const isTeam = category.competitionType === 'TEAM'
    const entity1 = isTeam ? match.team1 : match.fencer1
    const entity2 = isTeam ? match.team2 : match.fencer2
    return {
      ...match,
      participant1: entity1 ? {
        id: entity1.id,
        name: entity1.name,
        seedRank: match.participant1SeedRank ?? entity1.seedRank,
      } : null,
      participant2: entity2 ? {
        id: entity2.id,
        name: entity2.name,
        seedRank: match.participant2SeedRank ?? entity2.seedRank,
      } : null,
      participant1SeedRank: match.participant1SeedRank ?? null,
      participant2SeedRank: match.participant2SeedRank ?? null,
    }
  }) || []

  const isTeam = category.competitionType === 'TEAM'
  const participantLabel = isTeam ? '支隊伍' : '位選手'
  const entityLabel = isTeam ? '隊伍' : '選手'

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回首頁
        </Link>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
            <p className="text-gray-600 mt-1">{participantCount} {participantLabel}</p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabels[category.status]?.color}`}>
            {statusLabels[category.status]?.label}
          </span>
        </div>

        {/* ── Tabs ── */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('poules')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'poules'
                  ? 'border-red-500 text-red-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              分組賽
            </button>
            <button
              onClick={() => setActiveTab('bracket')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'bracket'
                  ? 'border-red-500 text-red-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Trophy className="h-4 w-4 inline mr-2" />
              淘汰賽
            </button>
            {category.status === 'finished' && (
              <button
                onClick={() => setActiveTab('rankings')}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === 'rankings'
                    ? 'border-red-500 text-red-700'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Award className="h-4 w-4 inline mr-2" />
                排名
              </button>
            )}
          </nav>
        </div>

        {/* ── 分組賽 tab ── */}
        {activeTab === 'poules' && (
          <div className="space-y-8">
            {category.poules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">尚未進行分組</CardContent>
              </Card>
            ) : (
              category.poules.map((poule) => {
                // 依 competitionType 選擇要傳給 PouleMatrix 的參賽者陣列
                const pouleParticipants = isTeam
                  ? (poule.teams || [])
                  : (poule.fencers || [])

                return (
                  <Card key={poule.id}>
                    <CardContent className="pt-6">
                      <PouleMatrix
                        pouleId={poule.id}
                        pouleName={poule.name}
                        competitionType={category.competitionType}
                        participants={pouleParticipants}
                        matches={poule.matches}
                        isAdmin={false}
                        onScoreUpdate={fetchCategory}
                        
                      />
                    </CardContent>
                  </Card>
                )
              })
            )}

            {/* 初賽排名表 */}
            {participantCount > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>初賽排名</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="min-w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">初賽名次</th>
                          <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">{entityLabel}</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽勝率</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽得分</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽失分</th>
                          <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽淨得失分</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {pouleRankings.map((participant, idx) => {
                          const rank = participant.pouleRank ?? idx + 1
                          const isEliminated = category.status !== 'poule' && rank > qualifiedCount
                          return (
                            <tr key={participant.id} className={isEliminated ? 'bg-red-100' : ''}>
                              <td className={`px-4 py-3 text-sm font-bold ${isEliminated ? 'text-red-700' : 'text-gray-900'}`}>
                                {rank}
                                {isEliminated && (
                                  <span className="ml-2 text-xs font-normal text-red-600">(淘汰)</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                {participant.name}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-600">
                                {formatWinRate(participant.winRate)}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-600">
                                {participant.touchesScored}
                              </td>
                              <td className="px-4 py-3 text-sm text-center text-gray-600">
                                {participant.touchesReceived}
                              </td>
                              <td className={`px-4 py-3 text-sm text-center font-medium ${
                                participant.indicator > 0 ? 'text-green-600' :
                                participant.indicator < 0 ? 'text-red-600' : 'text-gray-600'
                              }`}>
                                {formatIndicator(participant.indicator)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ── 淘汰賽 tab ── */}
        {activeTab === 'bracket' && (
          <Card>
            <CardContent className="pt-6">
              {category.bracket ? (
                <BracketTree
                  matches={formattedMatches}
                  competitionType={category.competitionType}
                  isAdmin={false}
                  onMatchUpdate={fetchCategory}
                />
              ) : (
                <div className="text-center text-gray-500 py-12">尚未開始淘汰賽</div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── 排名 tab ── */}
        {activeTab === 'rankings' && category.status === 'finished' && (
          <Card>
            <CardHeader>
              <CardTitle>總排名</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">名次</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">{entityLabel}</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽排名</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽勝率</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽得分</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽失分</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽淨得失分</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rankings.map((participant, idx) => {
                      const displayRank = participant.finalRank || participant.seedRank || idx + 1
                      return (
                        <tr
                          key={participant.id}
                          className={
                            displayRank <= 3 ? 'bg-yellow-50' :
                            idx >= qualifiedCount ? 'bg-red-100' : ''
                          }
                        >
                          <td className="px-4 py-3 text-sm">
                            <span className={`font-bold ${
                              displayRank === 1 ? 'text-yellow-600' :
                              displayRank === 2 ? 'text-gray-500' :
                              displayRank === 3 ? 'text-amber-700' : 'text-gray-900'
                            }`}>
                              {displayRank}
                              {(participant.finalRank || idx >= qualifiedCount) && (
                                <span className="ml-1 text-xs text-green-600">(最終)</span>
                              )}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900">{participant.name}</td>
                          <td className="px-4 py-3 text-sm text-center text-gray-900">
                            {participant.pouleRank ?? '-'}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            {formatWinRate(participant.winRate)}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            {participant.touchesScored}
                          </td>
                          <td className="px-4 py-3 text-sm text-center text-gray-600">
                            {participant.touchesReceived}
                          </td>
                          <td className={`px-4 py-3 text-sm text-center font-medium ${
                            participant.indicator > 0 ? 'text-green-600' :
                            participant.indicator < 0 ? 'text-red-600' : 'text-gray-600'
                          }`}>
                            {formatIndicator(participant.indicator)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
