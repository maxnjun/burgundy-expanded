/** User-confirmed red-line screenshot, 2026-10-19. No publisher ruling is claimed. */
export interface FortressLine {
  readonly id: "horizontal" | "left-diagonal" | "right-diagonal";
  readonly direction: string;
  readonly cellIds: readonly string[];
  readonly icon: { readonly x: number; readonly y: number };
}
const lines = (): readonly FortressLine[] => [
  { id:"horizontal",direction:"상단 가로줄",cellIds:["-1,-2","0,-2","1,-2","2,-2","3,-2"],icon:{x:70,y:138} },
  { id:"left-diagonal",direction:"왼쪽 대각선",cellIds:["-2,-1","-2,0","-2,1","-2,2","-2,3"],icon:{x:310,y:590} },
  { id:"right-diagonal",direction:"오른쪽 대각선",cellIds:["3,-1","2,0","1,1","0,2","-1,3"],icon:{x:550,y:138} },
];
// Separate explicit board records; the 37 terrain/number cells are never modified.
export const FORTRESS_BOARDS: Readonly<Record<string,readonly FortressLine[]>> = {
  "se:border-posts:23":lines(), "se:border-posts:24":lines(),
  "se:border-posts:25":lines(), "se:border-posts:26":lines(),
  "se:border-posts:27":lines(), "se:border-posts:28":lines(),
  "se:border-posts:29":lines(), "se:border-posts:30":lines(),
};
export const fortressLinesFor = (boardId:string):readonly FortressLine[] => FORTRESS_BOARDS[boardId]??[];
