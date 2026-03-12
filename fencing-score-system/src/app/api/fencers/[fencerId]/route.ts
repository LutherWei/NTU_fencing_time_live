import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { getCurrentUser } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ fencerId: string }>
}

// 獲取單一選手
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { fencerId } = await params

    const fencer = await prisma.fencer.findUnique({
      where: { id: fencerId },
      include: {
        category: true,
        poule: true
      }
    })

    if (!fencer) {
      return NextResponse.json(
        { success: false, error: '找不到該選手' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: fencer
    })
  } catch (error) {
    console.error('Get fencer error:', error)
    return NextResponse.json(
      { success: false, error: '獲取選手失敗' },
      { status: 500 }
    )
  }
}

// 更新選手
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { fencerId } = await params
    const data = await request.json()

    const fencer = await prisma.fencer.update({
      where: { id: fencerId },
      data
    })

    return NextResponse.json({
      success: true,
      data: fencer
    })
  } catch (error) {
    console.error('Update fencer error:', error)
    return NextResponse.json(
      { success: false, error: '更新選手失敗' },
      { status: 500 }
    )
  }
}

// 刪除選手
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return NextResponse.json(
        { success: false, error: '請先登入' },
        { status: 401 }
      )
    }

    const { fencerId } = await params

    await prisma.fencer.delete({
      where: { id: fencerId }
    })

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Delete fencer error:', error)
    return NextResponse.json(
      { success: false, error: '刪除選手失敗' },
      { status: 500 }
    )
  }
}
