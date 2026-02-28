/**
 * Conversations API
 *
 * GET  /api/conversations?privyUserId=xxx  → ユーザーの会話一覧
 * POST /api/conversations { privyUserId }  → 新規会話作成
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET(request: NextRequest) {
  try {
    const privyUserId = request.nextUrl.searchParams.get('privyUserId');
    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { privyUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversations = await prisma.conversation.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ conversations });
  } catch (error) {
    console.error('[Conversations API] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { privyUserId, title } = body;

    if (!privyUserId) {
      return NextResponse.json({ error: 'privyUserId is required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { privyUserId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const conversation = await prisma.conversation.create({
      data: {
        userId: user.id,
        title: title || null,
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    console.error('[Conversations API] POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
