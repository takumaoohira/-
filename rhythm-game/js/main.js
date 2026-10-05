// URL に ?dev を付けると開発用のチェック（譜面の検証ログ）を有効にする
RG.DEV = /[?&]dev\b/.test(location.search);
window.addEventListener('DOMContentLoaded', () => RG.App.init());
