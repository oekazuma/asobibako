/** data URL を File にする。共有シートは同期に呼ばないと通らないので、fetch などの await を使わずに組み立てる */
export function dataUrlFile(url: string, name: string): File {
  const [head, body] = url.split(',');
  const type = head.slice('data:'.length, head.indexOf(';base64'));
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type });
}

/**
 * 画像を端末へ出す。共有シートを使える端末では「画像を保存」で写真アプリへ入れられ、無ければダウンロードする。
 * Safari はユーザー操作のハンドラ内で同期に呼ばれた share() しか通さないので、押したときの処理の中でそのまま呼ぶ
 */
export function saveImage(url: string, name: string): void {
  if (!url) return;
  const file = dataUrlFile(url, name);
  if (navigator.canShare?.({ files: [file] })) {
    navigator.share({ files: [file] }).catch(() => {});
    return;
  }
  const href = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}
