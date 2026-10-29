import sharp from 'sharp';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {existsSync} from 'node:fs';

const resources = 'android/app/src/main/res';
const source = await readFile('public/tiles/castle.png');
for (const [density, size] of Object.entries({mdpi: 48, hdpi: 72, xhdpi: 96, xxhdpi: 144, xxxhdpi: 192})) {
  const directory = path.join(resources, `mipmap-${density}`);
  for (const name of ['ic_launcher', 'ic_launcher_round']) await sharp(source).resize(size, size, {fit: 'contain'}).png().toFile(path.join(directory, `${name}.png`));
  await sharp(source).resize(Math.round(size * 2.25), Math.round(size * 2.25), {fit: 'contain', background: '#f7edce'}).png().toFile(path.join(directory, 'ic_launcher_foreground.png'));
}
for (const folder of await readdir(resources)) if (folder.startsWith('drawable')) {
  const file = path.join(resources, folder, 'splash.png');
  if (!existsSync(file)) continue;
  try {
    const {width, height} = await sharp(file).metadata();
    const size = Math.round(Math.min(width, height) * .3);
    const icon = await sharp(source).resize(size, size, {fit: 'contain'}).toBuffer();
    await sharp({create: {width, height, channels: 4, background: '#f7edce'}}).composite([{input: icon}]).png().toFile(file + '.new');
    const {rename} = await import('node:fs/promises'); await rename(file + '.new', file);
  } catch (error) {if (error.code !== 'ENOENT') throw error;}
}
console.log('Android icon/splash reuse public/tiles/castle.png; no game assets changed.');
