import {NextResponse} from 'next/server';

import {loadState} from '@/utils/state';

export async function GET() {
  try {
    const state = await loadState();

    return NextResponse.json(state, {status: 200});
  } catch (error) {
    console.error(error);

    return NextResponse.json('Failed to get the operator state', {status: 500});
  }
}
