const fs = require('fs')
const path = '/tmp2/b12902102/NTU_fencing_time_live/fencing-score-system/src/app/admin/poules/[categoryId]/page.tsx'

let code = fs.readFileSync(path, 'utf8')

// Add imports if needed (User plus)
if(!code.includes('UserPlus')) {
  code = code.replace(/ArrowLeft, Trophy, Play, RotateCcw/g, 'ArrowLeft, Trophy, Play, RotateCcw, UserPlus')
}

// Add state
const stateToInject = `  const [isResetOpen, setIsResetOpen] = useState(false)
  const [isAddFencerOpen, setIsAddFencerOpen] = useState(false)
  const [newFencerName, setNewFencerName] = useState('')`

code = code.replace(/  const \[isResetOpen, setIsResetOpen\] = useState\(false\)/, stateToInject)

// Add handlers
const handlersToInject = `

  const handleAddFencer = async () => {
    if (!newFencerName.trim()) return
    setIsSubmitting(true)
    try {
      const res = await fetch(\`/api/poules/add-fencer\`, {
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
    if (!confirm(\`確定要將選手 \${fencerName} 移出比賽？此操作不可復原，且會移除所有其相關比分。\`)) return
    try {
      const res = await fetch(\`/api/fencers/\${fencerId}\`, {
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

`

code = code.replace(/  const handleStartElimination = async \(\) => {/, handlersToInject + '  const handleStartElimination = async () => {')

// Add button to header
const buttonToInject = `          {category.status === 'poule' && (
            <>
              <Button
                variant="outline"
                onClick={() => setIsAddFencerOpen(true)}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                新增選手
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsResetOpen(true)}
              >`

code = code.replace(/          \{category\.status === 'poule' && \(\n            <Button\n              variant="outline"\n              onClick=\{() => setIsResetOpen\(true\)\}/, buttonToInject)

// Pass onFencerDelete to matrix
code = code.replace(/isAdmin=\{true\}\n                    \/>/g, 'isAdmin={true}\n                      onFencerDelete={handleFencerDelete}\n                    />')

// Add modal
const modalToInject = `      {/* 新增選手彈窗 */}
      <Modal
        isOpen={isAddFencerOpen}
        onClose={() => setIsAddFencerOpen(false)}
        title="新增選手加入小組賽"
      >
        <div className="space-y-4">
          <p className="text-gray-600 text-sm">
            系統會自動尋找目前人數最少的小組並將選手加入該組，並自動產生對戰表。
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              選手姓名
            </label>
            <Input
              value={newFencerName}
              onChange={(e) => setNewFencerName(e.target.value)}
              placeholder="輸入選手姓名"
            />
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <Button
              variant="outline"
              onClick={() => setIsAddFencerOpen(false)}
              disabled={isSubmitting}
            >
              取消
            </Button>
            <Button
              onClick={handleAddFencer}
              disabled={isSubmitting || !newFencerName.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? '新增中...' : '確認新增'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 重置分組彈窗 */}`

code = code.replace(/      \{\/\* 重置分組彈窗 \*\/\}/, modalToInject)

fs.writeFileSync(path, code)
