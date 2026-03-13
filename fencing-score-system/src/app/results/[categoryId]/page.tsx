'use client'

import { useEffect, useState, use } from 'react'
import { Navbar } from '@/components/layout/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { PouleMatrix } from '@/components/poules/PouleMatrix'
import { BracketTree } from '@/components/bracket/BracketTree'
import { formatIndicator, formatWinRate, calculateQualifiedCount } from '@/lib/fencing-math'
import { ArrowLeft, Trophy, Users, Award } from 'lucide-react'
import Link from 'next/link'

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
}

interface PouleMatch {
  id: string
  fencer1Id: string
  fencer2Id: string
  score1: number | null
  score2: number | null
  completed: boolean
}

interface Poule {
  id: string
  name: string
  fencers: Fencer[]
  matches: PouleMatch[]
  completed: boolean
}

interface EliminationMatch {
  id: string
  round: number
  position: number
  fencer1Id: string | null
  fencer2Id: string | null
  fencer1: Fencer | null
  fencer2: Fencer | null
  score1: number | null
  score2: number | null
  winnerId: string | null
  winner: Fencer | null
  isBye: boolean
  isThirdPlace: boolean
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
  fencers: Fencer[]
  poules: Poule[]
  bracket: Bracket | null
}

const statusLabels: Record<string, { label: string; color: string }> = {
  checkin: { label: '檢錄中', color: 'bg-yellow-100 text-yellow-800' },
  poule: { label: '分組賽', color: 'bg-red-100 text-red-800' },
  elimination: { label: '淘汰賽', color: 'bg-purple-100 text-purple-800' },
  finished: { label: '已結束', color: 'bg-green-100 text-green-800' }
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
  }, [categoryId])

  const fetchCategory = async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`)
      const data = await res.json()
      if (data.success) {
        setCategory(data.data)
        // 根據狀態自動切換標籤
        if (data.data.status === 'elimination' || data.data.status === 'finished') {
          if (activeTab === 'poules' && data.data.bracket) {
            setActiveTab('bracket')
          }
        }
      }
    } catch (error) {
      console.error('Fetch category error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 計算最終排名
  const getFinalRankings = () => {
    if (!category) return []
    
    return [...category.fencers]
      .sort((a, b) => {
        // 有最終排名的排前面
        if (a.finalRank && b.finalRank) return a.finalRank - b.finalRank
        if (a.finalRank) return -1
        if (b.finalRank) return 1
        // 其他按種子排名
        if (a.seedRank && b.seedRank) return a.seedRank - b.seedRank
        return 0
      })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mx-auto"></div>
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
              <Link href="/" className="text-red-700 hover:underline mt-2 inline-block">
                返回首頁
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const rankings = getFinalRankings()
  
  // 計算淘汰線
  const eliminationRate = category.bracket?.eliminationRate ?? 0
  const qualifiedCount = calculateQualifiedCount(category.fencers.length, eliminationRate)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 返回連結 */}
        <Link href="/" className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="h-4 w-4 mr-1" />
          返回首頁
        </Link>

        {/* 標題區 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{category.name}</h1>
            <p className="text-gray-600 mt-1">
              {category.fencers.length} 位選手
            </p>
          </div>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusLabels[category.status]?.color}`}>
            {statusLabels[category.status]?.label}
          </span>
        </div>

        {/* 標籤切換 */}
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
          </nav>
        </div>

        {/* 分組賽 */}
        {activeTab === 'poules' && (
          <div className="space-y-8">
            {category.poules.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-gray-500">
                  尚未進行分組
                </CardContent>
              </Card>
            ) : (
              category.poules.map((poule) => (
                <Card key={poule.id}>
                  <CardContent className="pt-6">
                    <PouleMatrix
                      pouleId={poule.id}
                      pouleName={poule.name}
                      fencers={poule.fencers}
                      matches={poule.matches}
                      isAdmin={false}
                    />
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}

        {/* 淘汰賽 */}
        {activeTab === 'bracket' && (
          <Card>
            <CardContent className="pt-6">
              {category.bracket ? (
                <BracketTree
                  matches={category.bracket.matches}
                  isAdmin={false}
                />
              ) : (
                <div className="text-center text-gray-500 py-8">
                  尚未設置淘汰賽
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 排名 */}
        {activeTab === 'rankings' && (
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
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">選手</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽勝率</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽得分</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽失分</th>
                      <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽淨得失分</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {rankings.map((fencer, idx) => (
                      <tr key={fencer.id} className={
                        idx < 3 ? 'bg-yellow-50' : 
                        idx >= qualifiedCount ? 'bg-red-100' : 
                        ''
                      }>
                        <td className="px-4 py-3 text-sm">
                          <span className={`font-bold ${
                            idx === 0 ? 'text-yellow-600' :
                            idx === 1 ? 'text-gray-500' :
                            idx === 2 ? 'text-amber-700' : 'text-gray-900'
                          }`}>
                            {fencer.finalRank || fencer.seedRank || idx + 1}
                           {(fencer.finalRank || idx >= qualifiedCount) && (
                            <span className="ml-1 text-xs text-green-600">
                              (最終)
                            </span>
                          )}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">
                          {fencer.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {formatWinRate(fencer.winRate)}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {fencer.touchesScored}
                        </td>
                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                          {fencer.touchesReceived}
                        </td>
                        <td className={`px-4 py-3 text-sm text-center font-medium ${
                          fencer.indicator > 0 ? 'text-green-600' :
                          fencer.indicator < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {formatIndicator(fencer.indicator)}
                        </td>
                      </tr>
                    ))}
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
