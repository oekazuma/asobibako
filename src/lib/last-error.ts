const KEY = 'table-duel:last-error';

export interface LastError {
  message: string;
  at: number;
}

/** ホーム画面のアプリには DevTools がないので、最後に起きたエラーを 1 件だけ残して一覧に出す */
export function remember(message: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ message: message.slice(0, 300), at: Date.now() } satisfies LastError));
  } catch {
    // 保存できなければ諦める
  }
}

export function recall(): LastError | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LastError) : null;
  } catch {
    return null;
  }
}

export function forget(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // noop
  }
}

/** window の error / unhandledrejection を拾う。戻り値で外す */
export function watch(): () => void {
  const onError = (e: ErrorEvent) => remember(`${e.message} (${e.filename?.split('/').pop() ?? ''}:${e.lineno})`);
  const onReject = (e: PromiseRejectionEvent) => remember(String(e.reason?.message ?? e.reason));
  addEventListener('error', onError);
  addEventListener('unhandledrejection', onReject);
  return () => {
    removeEventListener('error', onError);
    removeEventListener('unhandledrejection', onReject);
  };
}
