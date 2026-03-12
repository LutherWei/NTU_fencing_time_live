'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input } from '@/components/ui/Input'
import { PouleMatrix } from '@/components/poules/PouleMatrix'
import { ArrowLeft, Trophy, Play } from 'lucide-react'

interface Fencer {
  id: string
  name: string
  victories: number
  defeats: number
  touchesScored: number
  touchesReceived: number
  indicator: number
  winRate: number
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
  const [eliminationRate, setEliminationRate] = useState(25)
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

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
      </div>
    )
  }

  if (!category) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">找不到該組別</p>
        <Link href="/admin/dashboard" className="text-blue-600 hover:underline mt-4 inline-block">
          返回後台
        </Link>
      </div>
    )
  }

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
            <h1 className="text-2xl font-bold text-gray-900">{category.name} - 分組賽</h1>
            <p className="text-gray-600">點擊表格中的空格來登記分數</p>
          </div>
        </div>
        
        {allPoulesCompleted && category.status === 'poule' && (
          <Button onClick={() => setIsEliminationOpen(true)}>
            <Trophy className="h-4 w-4 mr-2" />
            進入淘汰賽
          </Button>
        )}
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
                  fencers={poule.fencers}
                  matches={poule.matches}
                  isAdmin={true}
                  onScoreUpdate={fetchCategory}
                />
              </CardContent>
            </Card>
          ))}
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
    </div>
  )
}
