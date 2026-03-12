'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Navbar } from '@/components/layout/Navbar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Swords, Users, Trophy, Clock } from 'lucide-react'

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

export default function HomePage() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchCategories()
    // 每30秒自動刷新
    const interval = setInterval(fetchCategories, 30000)
    return () => clearInterval(interval)
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

  const activeCategories = categories.filter(c => c.status !== 'finished')
  const finishedCategories = categories.filter(c => c.status === 'finished')

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Swords className="h-16 w-16 mx-auto mb-4" />
            <h1 className="text-4xl font-bold mb-4">
              台大擊劍隊計分系統
            </h1>
            <p className="text-xl text-blue-100">
              即時追蹤比賽進度與分數
            </p>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">載入中...</p>
          </div>
        ) : categories.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                目前沒有進行中的比賽
              </h3>
              <p className="text-gray-500">
                請稍後再來查看，或聯繫管理員設置比賽
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* 進行中的比賽 */}
            {activeCategories.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <Clock className="h-6 w-6 mr-2 text-blue-600" />
                  進行中的比賽
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeCategories.map((category) => (
                    <Link key={category.id} href={`/results/${category.id}`}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                              {category.name}
                            </CardTitle>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[category.status]?.color || 'bg-gray-100'}`}>
                              {statusLabels[category.status]?.label || category.status}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center text-gray-600">
                            <Users className="h-4 w-4 mr-2" />
                            <span>{category._count.fencers} 位選手</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* 已結束的比賽 */}
            {finishedCategories.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center">
                  <Trophy className="h-6 w-6 mr-2 text-green-600" />
                  已結束的比賽
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {finishedCategories.map((category) => (
                    <Link key={category.id} href={`/results/${category.id}`}>
                      <Card className="hover:shadow-lg transition-shadow cursor-pointer bg-gray-50">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">
                              {category.name}
                            </CardTitle>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusLabels[category.status]?.color}`}>
                              {statusLabels[category.status]?.label}
                            </span>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center text-gray-600">
                            <Users className="h-4 w-4 mr-2" />
                            <span>{category._count.fencers} 位選手</span>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} 台大擊劍隊計分系統. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
