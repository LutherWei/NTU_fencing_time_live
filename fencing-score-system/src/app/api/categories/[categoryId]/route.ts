import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ categoryId: string }>
}

// 獲取單一組別詳情
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { categoryId } = await params

    const category = await prisma.category.findUnique({
      where: { id: categoryId },
      include: {
        fencers: {
          orderBy: [
            { seedRank: 'asc' },
            { name: 'asc' }
          ]
        },
        poules: {
          include: {
            fencers: true,
            matches: true
          }
        },
        bracket: {
          include: {
            matches: {
              include: {
                fencer1: true,
                fencer2: true,
                winner: true
              },
              orderBy: [
                { round: 'asc' },
                { position: 'asc' }
              ]
            }
          }
        }
      }
    })

    if (!category) {
      return NextResponse.json(
        { success: false, error: '找不到該組別' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Get category error:', error)
    return NextResponse.json(
      { success: false, error: '獲取組別失敗' },
      { status: 500 }
    )
  }
}

// 更新組別
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { categoryId } = await params
    const { name, status } = await request.json()

    const updateData: { name?: string; status?: string } = {}
    if (name) updateData.name = name.trim()
    if (status) updateData.status = status

    const category = await prisma.category.update({
      where: { id: categoryId },
      data: updateData
    })

    return NextResponse.json({
      success: true,
      data: category
    })
  } catch (error) {
    console.error('Update category error:', error)
    return NextResponse.json(
      { success: false, error: '更新組別失敗' },
      { status: 500 }
    )
  }
}

// 刪除組別
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { categoryId } = await params

    await prisma.category.delete({
      where: { id: categoryId }
    })

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Delete category error:', error)
    return NextResponse.json(
      { success: false, error: '刪除組別失敗' },
      { status: 500 }
    )
  }
}
