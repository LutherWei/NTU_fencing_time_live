'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { 
  Users, 
  Trophy, 
  Grid3X3, 
  Clock,
  ArrowRight,
  Plus
} from 'lucide-react'

interface Category {
  id: string
  name: string
  status: string
  _count: {
    fencers: number
  }
}

const statusLabels: Record<string, { label: string; color: string }> = {
  checkin: { label: '檢錄中', color: 'bg-yellow-100 text-yellow-800' },
  poule: { label: '分組賽', color: 'bg-blue-100 text-blue-800' },
  elimination: { label: '淘汰賽', color: 'bg-purple-100 text-purple-800' },
  finished: { label: '已結束', color: 'bg-green-100 text-green-800' }
}

export default function DashboardPage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
      }
    } catch (error) {
      console.error('Fetch categories error:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalFencers = categories.reduce((sum, c) => sum + c._count.fencers, 0)
  const activeCategories = categories.filter(c => c.status !== 'finished')
  const finishedCategories = categories.filter(c => c.status === 'finished')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">管理後台</h1>
          <p className="text-gray-600">歡迎回來！以下是目前比賽的概況。</p>
        </div>
        <Link href="/admin/check-in">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            新增組別
          </Button>
        </Link>
      </div>

      {/* 統計卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總組別數</CardTitle>
            <Grid3X3 className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{categories.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">總選手數</CardTitle>
            <Users className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFencers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">進行中</CardTitle>
            <Clock className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCategories.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已結束</CardTitle>
            <Trophy className="h-4 w-4 text-gray-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{finishedCategories.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* 組別列表 */}
      <Card>
        <CardHeader>
          <CardTitle>所有組別</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : categories.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">目前沒有任何組別</p>
              <Link href="/admin/check-in">
                <Button variant="outline">
                  <Plus className="h-4 w-4 mr-2" />
                  新增第一個組別
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className="flex items-center justify-between py-4"
                >
                  <div className="flex items-center space-x-4">
                    <div>
                      <h3 className="font-medium text-gray-900">{category.name}</h3>
                      <p className="text-sm text-gray-500">
                        {category._count.fencers} 位選手
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[category.status]?.color}`}>
                      {statusLabels[category.status]?.label}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {category.status === 'checkin' && (
                      <Link href={`/admin/check-in`}>
                        <Button variant="outline" size="sm">
                          檢錄
                        </Button>
                      </Link>
                    )}
                    {category.status === 'poule' && (
                      <Link href={`/admin/poules/${category.id}`}>
                        <Button variant="outline" size="sm">
                          分組賽
                        </Button>
                      </Link>
                    )}
                    {(category.status === 'elimination' || category.status === 'finished') && (
                      <Link href={`/admin/bracket/${category.id}`}>
                        <Button variant="outline" size="sm">
                          淘汰賽
                        </Button>
                      </Link>
                    )}
                    <Link href={`/results/${category.id}`}>
                      <Button variant="ghost" size="sm">
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
