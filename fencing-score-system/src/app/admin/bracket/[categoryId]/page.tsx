'use client'

import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BracketTree } from '@/components/bracket/BracketTree'
import { ArrowLeft, Trophy, Medal } from 'lucide-react'
import { formatIndicator, formatWinRate, calculateQualifiedCount } from '@/lib/fencing-math'

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
  bracket: Bracket | null
}

interface PageProps {
  params: Promise<{ categoryId: string }>
}

export default function BracketPage({ params }: PageProps) {
  const { categoryId } = use(params)
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategory()
  }, [categoryId])

  const fetchCategory = async () => {
    try {
      const res = await fetch(`/api/categories/${categoryId}`)
      const data = await res.json()
      if (data.success) {
        setCategory(data.data)
      }
    } catch (error) {
      console.error('Fetch category error:', error)
    } finally {
      setLoading(false)
    }
  }

  // 獲取排名後的選手列表
  const getRankedFencers = () => {
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

  const rankedFencers = getRankedFencers()

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-700 mx-auto"></div>
      </div>
    )
  }
  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到該組別</p>
        <Link href="/admin/dashboard" className="text-red-700 hover:underline mt-4 inline-block">
          返回後台
        </Link>
      </div>
    )
  }

  const eliminationRate = category.bracket?.eliminationRate ?? 0
  const qualifiedCount = calculateQualifiedCount(category.fencers.length, eliminationRate)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {category.name} - 淘汰賽
            </h1>
            <p className="text-gray-600">點擊比賽方塊來登記分數</p>
          </div>
        </div>
        
        {category.status === 'finished' && (
          <div className="flex items-center text-green-600">
            <Trophy className="h-5 w-5 mr-2" />
            <span className="font-medium">比賽已結束</span>
          </div>
        )}
      </div>

      {/* 淘汰賽樹狀圖 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Trophy className="h-5 w-5 mr-2" />
            淘汰賽賽程
          </CardTitle>
        </CardHeader>
        <CardContent>
          {category.bracket ? (
            <BracketTree
              matches={category.bracket.matches}
              isAdmin={true}
              onMatchUpdate={fetchCategory}
            />
          ) : (
            <div className="text-center text-gray-500 py-8">
              尚未設置淘汰賽
            </div>
          )}
        </CardContent>
      </Card>

      {/* 現在排名 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Medal className="h-5 w-5 mr-2" />
            當前排名
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">名次</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">選手</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">初賽勝率</th>
                  <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">淨得失分</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {rankedFencers.map((fencer, idx) => {
                  const displayRank = fencer.finalRank || fencer.seedRank || idx + 1
                  const isTopThree = displayRank <= 3
                  
                  return (
                    <tr key={fencer.id} className={
                        idx < 3 ? 'bg-yellow-50' : 
                        idx >= qualifiedCount ? 'bg-red-100' : 
                        ''
                      }>
                      <td className="px-4 py-3 text-sm">
                        <span className={`font-bold ${
                          displayRank === 1 ? 'text-yellow-600' :
                          displayRank === 2 ? 'text-gray-500' :
                          displayRank === 3 ? 'text-amber-700' : 'text-gray-900'
                        }`}>
                          {displayRank}
                          {fencer.finalRank && (
                            <span className="ml-1 text-xs text-green-600">
                              (最終)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">
                        {fencer.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-center">
                        {formatWinRate(fencer.winRate)}
                      </td>
                      <td className={`px-4 py-3 text-sm text-center font-medium ${
                        fencer.indicator > 0 ? 'text-green-600' :
                        fencer.indicator < 0 ? 'text-red-600' : ''
                      }`}>
                        {formatIndicator(fencer.indicator)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
