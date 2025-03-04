import {NextRequest, NextResponse} from 'next/server';

import {loadState, watchState} from '@/utils/state';

export async function GET(request: NextRequest) {
  const abortController = new AbortController();

  const stream = new ReadableStream({
    start(controller) {
      const sendEvent = (data: object) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };

      controller.enqueue(': connected\n\n');
      sendEvent({message: 'connected', timestamp: new Date().toISOString()});

      watchState(abortController, async () => {
        const newState = await loadState();

        sendEvent({message: 'state-change', state: newState.state, timestamp: newState.lastUpdate.toISOString()});
      });

      request.signal.addEventListener('abort', () => {
        controller.close();
      });
    },
    cancel() {
      abortController.abort();
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
