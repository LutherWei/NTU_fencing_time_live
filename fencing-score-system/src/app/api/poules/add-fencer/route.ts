import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'
import { calculatePouleStats } from '@/lib/fencing-math'

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: '請先登入' }, { status: 401 })

    const { categoryId, name } = await request.json()
    if (!categoryId || !name) {
      return NextResponse.json({ success: false, error: '缺少必要參數' }, { status: 400 })
    }

    // find category and its poules
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        poules: {
          include: { fencers: true }
        }
      }
    })

    if (!category || category.poules.length === 0) {
      return NextResponse.json({ success: false, error: '無此組別或尚未分組' }, { status: 400 })
    }

    // 分組賽結束後（已進入淘汰賽或比賽已結束）不得再異動小組成員
    if (category.status === 'elimination' || category.status === 'finished') {
      return NextResponse.json({ success: false, error: '分組賽階段已結束，無法再新增選手' }, { status: 400 })
    }

    // find poule with min fencers
    let targetPoule = category.poules[0]
    for (const p of category.poules) {
      if (p.fencers.length < targetPoule.fencers.length) {
        targetPoule = p
      }
    }

    // Create fencer
    const newFencer = await prisma.fencer.create({
      data: {
        name: name.trim(),
        categoryId,
        pouleId: targetPoule.id,
        checkedIn: true
      }
    })

    // Create matches against all existing fencers in targetPoule
    const createMatchesPromises = targetPoule.fencers.map(f => {
      // 確保只建立唯一的組合
      const isF1First = f.id < newFencer.id
      return prisma.pouleMatch.create({
        data: {
          pouleId: targetPoule.id,
          fencer1Id: isF1First ? f.id : newFencer.id,
          fencer2Id: isF1First ? newFencer.id : f.id
        }
      })
    })

    await Promise.all(createMatchesPromises)

    // Recalculate poule completions
    await prisma.poule.update({
      where: { id: targetPoule.id },
      data: { completed: false }
    })

    return NextResponse.json({ success: true, data: newFencer })
  } catch (error) {
    console.error('Add fencer error:', error)
    return NextResponse.json({ success: false, error: '新增選手失敗' }, { status: 500 })
  }
}
