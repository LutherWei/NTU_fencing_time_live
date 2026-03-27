'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { PouleMatrix } from '@/components/poules/PouleMatrix'
import { ArrowLeft, Trophy, Play, RotateCcw, UserPlus } from 'lucide-react'
import { formatWinRate, formatIndicator, calculateQualifiedCount } from '@/lib/fencing-math'

interface Fencer {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
  pouleRank?: number | null
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

interface Category {
  id: string
  name: string
  status: string
  fencers: Fencer[]
  poules: Poule[]
}

interface PageProps {
  params: Promise<{ categoryId: string }>
}

export default function PoulesPage({ params }: PageProps) {
  const { categoryId } = use(params)
  const router = useRouter()
  const [category, setCategory] = useState<Category | null>(null)
  const [loading, setLoading] = useState(true)
  const [isEliminationOpen, setIsEliminationOpen] = useState(false)
  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isAddFencerOpen, setIsAddFencerOpen] = useState(false)
  const [newFencerName, setNewFencerName] = useState('')
  const [eliminationRate, setEliminationRate] = useState(0)
  const [hasThirdPlace, setHasThirdPlace] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

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

  // 檢查所有分組賽是否完成
  const allPoulesCompleted = category?.poules.every(p => {
    const totalMatches = (p.fencers.length * (p.fencers.length - 1)) / 2
    const completedMatches = p.matches.filter(m => m.completed).length
    return completedMatches >= totalMatches
  }) ?? false



  const handleAddFencer = async () => {
    if (!newFencerName.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`/api/poules/add-fencer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, name: newFencerName })
      })
      const data = await res.json()
      if (data.success) {
        setIsAddFencerOpen(false)
        setNewFencerName('')
        fetchCategory()
      } else {
        alert(data.error || '新增失敗')
      }
    } catch (e) {
      alert('新增失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFencerDelete = async (fencerId: string, fencerName: string) => {
    if (!confirm(`確定要將選手 ${fencerName} 移出比賽？此操作不可復原，且會移除所有其相關比分。`)) return
    try {
      const res = await fetch(`/api/fencers/${fencerId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchCategory()
      } else {
        alert(data.error || '棄賽失敗')
      }
    } catch (e) {
      alert('棄賽失敗')
    }
  }

  const handleStartElimination = async () => {
    if (!category) return

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/bracket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: category.id,
          eliminationRate: eliminationRate / 100,
          hasThirdPlace
        })
      })

      const data = await res.json()
      if (data.success) {
        router.push(`/admin/bracket/${categoryId}`)
      } else {
        alert(data.error || '設置淘汰賽失敗')
      }
    } catch (error) {
      console.error('Start elimination error:', error)
      alert('設置淘汰賽失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleResetPoules = async () => {
    if (!category) return

    setIsSubmitting(true)

    try {
      const res = await fetch(`/api/categories/${categoryId}/reset-poules`, {
        method: 'POST'
      })

      const data = await res.json()
      if (data.success) {
        alert('已重置分組，將返回檢錄頁面')
        router.push('/admin/check-in')
      } else {
        alert(data.error || '重置失敗')
      }
    } catch (error) {
      console.error('Reset poules error:', error)
      alert('重置失敗')
    } finally {
      setIsSubmitting(false)
      setIsResetOpen(false)
    }
  }

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

  // 計算初賽排名
  const getPouleRankings = () => {
    if (!category) return []
    
    return [...category.fencers].sort((a, b) => {
      // 依據勝率 -> 淨得分 -> 總得分 降序
      if (a.winRate !== b.winRate) return b.winRate - a.winRate
      if (a.indicator !== b.indicator) return b.indicator - a.indicator
      const scoreDiff = b.touchesScored - a.touchesScored
      if (scoreDiff !== 0) return scoreDiff
      return a.id.localeCompare(b.id)
    })
  }

  const pouleRankings = getPouleRankings()
  const eliminatedCount = parseInt(eliminationRate.toString()) || 0
  const qualifiedCount = calculateQualifiedCount(category.fencers.length, eliminatedCount / 100)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link href="/admin/dashboard">
            <Button variant="ghost" size="sm" className="text-red-700 hover:text-red-800 hover:bg-red-50">
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{category.name} - 分組賽</h1>
            <p className="text-gray-600">點擊表格中的空格來登記分數</p>
          </div>
        </div>
        
        <div className="flex space-x-2">
          {category.status === 'poule' && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsAddFencerOpen(true)}
                className="text-red-700 border-red-200 hover:bg-red-50"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                新增選手
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsResetOpen(true)}
                className="text-red-700 border-red-200 hover:bg-red-50"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                重新分組
              </Button>
            </>
          )}
          
          {allPoulesCompleted && category.status === 'poule' && (
            <Button onClick={() => setIsEliminationOpen(true)}>
              <Trophy className="h-4 w-4 mr-2" />
              進入淘汰賽
            </Button>
          )}
        </div>
      </div>

      {/* 分組賽完成進度 */}
      {!allPoulesCompleted && (
        <Card className="bg-yellow-50 border-yellow-200">
          <CardContent className="py-4">
            <p className="text-yellow-800">
              請完成所有分組賽的分數登記後，才能進入淘汰賽階段
            </p>
          </CardContent>
        </Card>
      )}

      {/* 各小組的計分矩陣 */}
      {category.poules.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            尚未進行分組
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {category.poules.map((poule) => (
            <Card key={poule.id}>
              <CardContent className="pt-6">
                <PouleMatrix
                  pouleId={poule.id}
                  pouleName={poule.name}
                  fencers={poule.fencers.map(f => ({
                    ...f,
                    isEliminated: f.pouleRank != null && (f.pouleRank as number) > qualifiedCount
                  }))}
                  matches={poule.matches}
                  isAdmin={true}
                  onScoreUpdate={fetchCategory}
                  onFencerDelete={handleFencerDelete}
                />
              </CardContent>
            </Card>
          ))}

          {category.fencers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>預覽初賽排名</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">初賽名次</th>
                        <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">選手</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽勝率</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽得分</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽失分</th>
                        <th className="px-4 py-3 text-center text-sm font-semibold text-gray-900">預賽淨得失分</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {pouleRankings.map((fencer, idx) => {
                        const rank = fencer.pouleRank ?? idx + 1
                        const isEliminated = rank > qualifiedCount
                        return (
                          <tr key={fencer.id} className={isEliminated ? 'bg-red-100' : ''}>
                            <td className={`px-4 py-3 text-sm font-bold ${isEliminated ? 'text-red-700' : 'text-gray-900'}`}>
                              {rank}
                              {isEliminated && <span className="ml-2 text-xs font-normal text-red-600">(淘汰)</span>}
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

      {/* 進入淘汰賽 Modal */}
      <Modal
        isOpen={isEliminationOpen}
        onClose={() => setIsEliminationOpen(false)}
        title="設置淘汰賽"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              淘汰比率（%）
            </label>
            <Input
              type="number"
              min="0"
              max="75"
              value={eliminationRate}
              onChange={(e) => setEliminationRate(parseInt(e.target.value) || 0)}
            />
            <p className="text-sm text-gray-500 mt-1">
              將有 {Math.ceil(category.fencers.length * (1 - eliminationRate / 100))} 位選手晉級淘汰賽
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="thirdPlace"
              checked={hasThirdPlace}
              onChange={(e) => setHasThirdPlace(e.target.checked)}
              className="rounded border-gray-300"
            />
            <label htmlFor="thirdPlace" className="text-sm font-medium text-gray-700">
              進行三四名決定戰
            </label>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            <p>排名依序比較：勝率 &gt; 淨得失分 &gt; 得分</p>
            <p className="mt-1">若三項皆相同則隨機決定（涉及晉級者一律晉級）</p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEliminationOpen(false)}>
              取消
            </Button>
            <Button onClick={handleStartElimination} disabled={isSubmitting}>
              {isSubmitting ? '處理中...' : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  開始淘汰賽
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 重新分組 Modal */}
      <Modal
        isOpen={isResetOpen}
        onClose={() => setIsResetOpen(false)}
        title="重新分組"
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 font-medium mb-2">⚠️ 警告</p>
            <p className="text-red-700 text-sm">
              此操作將會刪除所有分組賽記錄和已填寫的分數，且無法復原。確定要重新分組嗎？
            </p>
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsResetOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleResetPoules}
              disabled={isSubmitting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isSubmitting ? '處理中...' : '確定重新分組'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 新增選手 Modal */}
      <Modal
        isOpen={isAddFencerOpen}
        onClose={() => setIsAddFencerOpen(false)}
        title="新增選手"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              選手姓名
            </label>
            <Input
              type="text"
              value={newFencerName}
              onChange={(e) => setNewFencerName(e.target.value)}
              placeholder="輸入選手名字"
              autoFocus
            />
          </div>

          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddFencerOpen(false)}>
              取消
            </Button>
            <Button
              onClick={handleAddFencer}
              disabled={isSubmitting || !newFencerName.trim()}
            >
              {isSubmitting ? '處理中...' : '確定新增'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
