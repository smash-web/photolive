// Компилятор .mind-файла из фотографий — выполняется прямо в браузере
// клиента (админа) при загрузке фото, без всякого сервера. Библиотека
// подключена через CDN importmap в index.html (специфик "mind-ar-image"),
// поэтому здесь обычный import, как если бы это был npm-пакет.
import { Compiler } from "mind-ar-image";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export async function compileTargets(imageUrls, onProgress) {
  const images = await Promise.all(imageUrls.map(loadImage));
  const compiler = new Compiler();
  await compiler.compileImageTargets(images, (progress) => {
    if (onProgress) onProgress(progress);
  });
  const buffer = await compiler.exportData();
  return buffer;
}
