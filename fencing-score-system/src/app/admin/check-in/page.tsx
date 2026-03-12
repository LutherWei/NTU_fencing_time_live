'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { 
  Plus, 
  Trash2, 
  Users, 
  Edit2,
  Grid3X3,
  Play
} from 'lucide-react'

interface Fencer {
  id: string
  name: string
  checkedIn: boolean
}

interface Category {
  id: string
  name: string
  status: string
  fencers: Fencer[]
}

export default function CheckInPage() {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  // Modal states
  const [isAddCategoryOpen, setIsAddCategoryOpen] = useState(false)
  const [isAddFencerOpen, setIsAddFencerOpen] = useState(false)
  const [isEditCategoryOpen, setIsEditCategoryOpen] = useState(false)
  const [isGroupingOpen, setIsGroupingOpen] = useState(false)
  
  // Form states
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newFencerName, setNewFencerName] = useState('')
  const [editCategoryName, setEditCategoryName] = useState('')
  const [editCategoryId, setEditCategoryId] = useState('')
  
  // Grouping state
  const [groupCount, setGroupCount] = useState(2)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      const data = await res.json()
      if (data.success) {
        setCategories(data.data)
        if (data.data.length > 0 && !selectedCategory) {
          setSelectedCategory(data.data[0].id)
        }
      }
    } catch (error) {
      console.error('Fetch categories error:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return

    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setNewCategoryName('')
        setIsAddCategoryOpen(false)
        fetchCategories()
        setSelectedCategory(data.data.id)
      } else {
        alert(data.error || '新增失敗')
      }
    } catch (error) {
      console.error('Add category error:', error)
      alert('新增失敗')
    }
  }

  const handleEditCategory = async () => {
    if (!editCategoryName.trim() || !editCategoryId) return

    try {
      const res = await fetch(`/api/categories/${editCategoryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editCategoryName.trim() })
      })
      const data = await res.json()
      if (data.success) {
        setIsEditCategoryOpen(false)
        fetchCategories()
      } else {
        alert(data.error || '更新失敗')
      }
    } catch (error) {
      console.error('Edit category error:', error)
      alert('更新失敗')
    }
  }

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('確定要刪除此組別嗎？所有選手資料將一併刪除。')) return

    try {
      const res = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchCategories()
        if (selectedCategory === categoryId) {
          setSelectedCategory(null)
        }
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch (error) {
      console.error('Delete category error:', error)
      alert('刪除失敗')
    }
  }

  const handleAddFencer = async () => {
    if (!newFencerName.trim() || !selectedCategory) return

    try {
      const res = await fetch('/api/fencers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newFencerName.trim(),
          categoryId: selectedCategory
        })
      })
      const data = await res.json()
      if (data.success) {
        setNewFencerName('')
        setIsAddFencerOpen(false)
        fetchCategories()
      } else {
        alert(data.error || '新增失敗')
      }
    } catch (error) {
      console.error('Add fencer error:', error)
      alert('新增失敗')
    }
  }

  const handleDeleteFencer = async (fencerId: string) => {
    if (!confirm('確定要刪除此選手嗎？')) return

    try {
      const res = await fetch(`/api/fencers/${fencerId}`, {
        method: 'DELETE'
      })
      const data = await res.json()
      if (data.success) {
        fetchCategories()
      } else {
        alert(data.error || '刪除失敗')
      }
    } catch (error) {
      console.error('Delete fencer error:', error)
      alert('刪除失敗')
    }
  }

  const handleStartGrouping = async () => {
    if (!selectedCategory) return
    
    const category = categories.find(c => c.id === selectedCategory)
    if (!category || category.fencers.length < 4) {
      alert('選手人數至少需要4人才能開始分組')
      return
    }

    // 計算每組人數
    const fencerCount = category.fencers.length
    const actualGroupCount = Math.min(groupCount, Math.floor(fencerCount / 4))
    
    if (actualGroupCount < 1) {
      alert('人數不足以分組')
      return
    }

    // 簡單的隨機分組
    const shuffledFencers = [...category.fencers].sort(() => Math.random() - 0.5)
    const groups: { name: string; fencerIds: string[] }[] = []
    
    const baseSize = Math.floor(fencerCount / actualGroupCount)
    const extraCount = fencerCount % actualGroupCount
    
    let startIdx = 0
    for (let i = 0; i < actualGroupCount; i++) {
      const size = baseSize + (i < extraCount ? 1 : 0)
      groups.push({
        name: `${String.fromCharCode(65 + i)}組`, // A組, B組, ...
        fencerIds: shuffledFencers.slice(startIdx, startIdx + size).map(f => f.id)
      })
      startIdx += size
    }

    // 驗證每組人數
    for (const group of groups) {
      if (group.fencerIds.length < 4 || group.fencerIds.length > 8) {
        alert(`分組錯誤：${group.name}人數須為4-8人`)
        return
      }
    }

    setIsSubmitting(true)

    try {
      const res = await fetch('/api/poules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: selectedCategory,
          poules: groups
        })
      })
      
      const data = await res.json()
      if (data.success) {
        setIsGroupingOpen(false)
        router.push(`/admin/poules/${selectedCategory}`)
      } else {
        alert(data.error || '分組失敗')
      }
    } catch (error) {
      console.error('Create groups error:', error)
      alert('分組失敗')
    } finally {
      setIsSubmitting(false)
    }
  }

  const currentCategory = categories.find(c => c.id === selectedCategory)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">選手檢錄</h1>
          <p className="text-gray-600">管理比賽組別與參賽選手</p>
        </div>
        <Button onClick={() => setIsAddCategoryOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          新增組別
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 組別列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">組別列表</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            ) : categories.length === 0 ? (
              <p className="text-gray-500 text-center py-4">尚無組別</p>
            ) : (
              <div className="space-y-2">
                {categories.map((category) => (
                  <div
                    key={category.id}
                    className={`p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedCategory === category.id
                        ? 'bg-blue-50 border border-blue-200'
                        : 'bg-gray-50 hover:bg-gray-100'
                    }`}
                    onClick={() => setSelectedCategory(category.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">{category.name}</h3>
                        <p className="text-sm text-gray-500">
                          {category.fencers.length} 位選手
                        </p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditCategoryId(category.id)
                            setEditCategoryName(category.name)
                            setIsEditCategoryOpen(true)
                          }}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <Edit2 className="h-4 w-4 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteCategory(category.id)
                          }}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 選手列表 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center">
                <Users className="h-5 w-5 mr-2" />
                {currentCategory ? currentCategory.name : '選擇組別'}
              </CardTitle>
              {currentCategory && currentCategory.status === 'checkin' && (
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddFencerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    新增選手
                  </Button>
                  {currentCategory.fencers.length >= 4 && (
                    <Button
                      size="sm"
                      onClick={() => setIsGroupingOpen(true)}
                    >
                      <Grid3X3 className="h-4 w-4 mr-1" />
                      開始分組
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {!currentCategory ? (
              <p className="text-gray-500 text-center py-8">
                請選擇左側的組別以管理選手
              </p>
            ) : currentCategory.fencers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">尚無選手</p>
                <Button
                  variant="outline"
                  className="mt-4"
                  onClick={() => setIsAddFencerOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  新增第一位選手
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {currentCategory.fencers.map((fencer, idx) => (
                  <div
                    key={fencer.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <span className="text-gray-400 text-sm w-6">
                        {idx + 1}.
                      </span>
                      <span className="font-medium">{fencer.name}</span>
                    </div>
                    {currentCategory.status === 'checkin' && (
                      <button
                        onClick={() => handleDeleteFencer(fencer.id)}
                        className="p-1 hover:bg-red-100 rounded"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            
            {currentCategory && currentCategory.status !== 'checkin' && (
              <div className="mt-4 p-4 bg-yellow-50 rounded-lg text-yellow-800 text-sm">
                此組別已進入{currentCategory.status === 'poule' ? '分組賽' : '淘汰賽'}階段，無法編輯選手
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新增組別 Modal */}
      <Modal
        isOpen={isAddCategoryOpen}
        onClose={() => setIsAddCategoryOpen(false)}
        title="新增組別"
      >
        <div className="space-y-4">
          <Input
            placeholder="組別名稱（例：男子鈍劍）"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddCategoryOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddCategory}>新增</Button>
          </div>
        </div>
      </Modal>

      {/* 編輯組別 Modal */}
      <Modal
        isOpen={isEditCategoryOpen}
        onClose={() => setIsEditCategoryOpen(false)}
        title="編輯組別"
      >
        <div className="space-y-4">
          <Input
            placeholder="組別名稱"
            value={editCategoryName}
            onChange={(e) => setEditCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleEditCategory()}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsEditCategoryOpen(false)}>
              取消
            </Button>
            <Button onClick={handleEditCategory}>儲存</Button>
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
          <Input
            placeholder="選手姓名"
            value={newFencerName}
            onChange={(e) => setNewFencerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFencer()}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddFencerOpen(false)}>
              取消
            </Button>
            <Button onClick={handleAddFencer}>新增</Button>
          </div>
        </div>
      </Modal>

      {/* 開始分組 Modal */}
      <Modal
        isOpen={isGroupingOpen}
        onClose={() => setIsGroupingOpen(false)}
        title="開始分組賽"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            將 {currentCategory?.fencers.length} 位選手隨機分為以下組數：
          </p>
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium">分組數量：</label>
            <Input
              type="number"
              min="1"
              max={Math.floor((currentCategory?.fencers.length || 0) / 4)}
              value={groupCount}
              onChange={(e) => setGroupCount(parseInt(e.target.value) || 1)}
              className="w-20"
            />
            <span className="text-sm text-gray-500">
              （每組 4-8 人）
            </span>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600">
            <p>分組完成後將進入分組賽階段，屆時無法再編輯選手名單。</p>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsGroupingOpen(false)}>
              取消
            </Button>
            <Button onClick={handleStartGrouping} disabled={isSubmitting}>
              {isSubmitting ? '處理中...' : (
                <>
                  <Play className="h-4 w-4 mr-1" />
                  開始分組
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
