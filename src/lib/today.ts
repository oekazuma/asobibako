/** ローカル日付の YYYY-MM-DD。バックアップのファイル名と保護者ゲートの「今日」に使う */
export const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
