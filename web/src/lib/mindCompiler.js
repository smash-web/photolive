// Компилирует набор изображений в один .mind-файл для MindAR.
// Запускается прямо в браузере (использует tensorflow.js внутри),
// без какого-либо сервера — поэтому это может занять заметное время
// (секунды, иногда десятки секунд на слабом устройстве), особенно
// при добавлении нового фото клиенту, у которого уже много фото
// (пересчитывается ВЕСЬ набор заново, так MindAR хранит несколько
// целей в одном файле).

import { Compiler } from "mind-ar/dist/mindar-image.prod.js";

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * imageUrls: string[] — публичные URL фото, в том порядке, в котором
 * они должны стать targetIndex 0, 1, 2, ...
 * onProgress: (percent: number) => void — необязательный колбэк прогресса
 * Возвращает ArrayBuffer с содержимым .mind-файла.
 */
export async function compileTargets(imageUrls, onProgress) {
  const images = await Promise.all(imageUrls.map(loadImage));
  const compiler = new Compiler();
  await compiler.compileImageTargets(images, (progress) => {
    if (onProgress) onProgress(progress);
  });
  const buffer = await compiler.exportData();
  return buffer;
}
