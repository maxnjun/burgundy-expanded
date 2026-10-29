import {Capacitor} from '@capacitor/core';

export async function downloadSave(text: string) {
  if (Capacitor.isNativePlatform()) {
    const [{Filesystem, Directory, Encoding}, {Share}] = await Promise.all([
      import('@capacitor/filesystem'), import('@capacitor/share'),
    ]);
    const file = await Filesystem.writeFile({path: 'burgundy-save.json', data: text, directory: Directory.Cache, encoding: Encoding.UTF8});
    await Share.share({title: 'Burgundy Expanded 저장 파일', files: [file.uri], dialogTitle: '게임 저장 파일 내보내기'});
    return;
  }
  const url = URL.createObjectURL(new Blob([text], {type: 'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'burgundy-save.json'; link.click(); URL.revokeObjectURL(url);
}
