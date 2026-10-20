import standard from "./tile-standard.json";
/** Pointy-top axial geometry, in board SVG units. No game/board data is changed. */
export const ESTATE_RADIUS=standard.estateRadius;
export const ESTATE_HALF_WIDTH=Math.sqrt(3)*ESTATE_RADIUS/2;
/** Artwork uses the same pointy hex ratio as the actual board cell. */
export const ESTATE_ART_HEIGHT=standard.artWidth*ESTATE_RADIUS/ESTATE_HALF_WIDTH;
export function estateCenter({q,r}:{q:number;r:number}){return {x:310+Math.sqrt(3)*ESTATE_RADIUS*(q+r/2),y:282+1.5*ESTATE_RADIUS*r};}
export function estateCorners(coord:{q:number;r:number}){const {x,y}=estateCenter(coord);return [[x+ESTATE_HALF_WIDTH,y-ESTATE_RADIUS/2],[x+ESTATE_HALF_WIDTH,y+ESTATE_RADIUS/2],[x,y+ESTATE_RADIUS],[x-ESTATE_HALF_WIDTH,y+ESTATE_RADIUS/2],[x-ESTATE_HALF_WIDTH,y-ESTATE_RADIUS/2],[x,y-ESTATE_RADIUS]] as const;}
export function estatePoints(coord:{q:number;r:number},inset=0){const center=estateCenter(coord),scale=1-inset/ESTATE_HALF_WIDTH;return estateCorners(coord).map(([x,y])=>[center.x+(x-center.x)*scale,center.y+(y-center.y)*scale].join(",")).join(" ");}
/** Adjacent cells use the very same edge, drawn once rather than two overlapping strokes. */
export function estateEdges(cells:readonly {id?:string;coord:{q:number;r:number}}[],framed:readonly string[]=[]){const edges=new Map<string,string>(),hidden=new Set<string>();for(const cell of cells){const points=estateCorners(cell.coord);for(let i=0;i<6;i++){const a=points[i],b=points[(i+1)%6],key=[a.map(n=>n.toFixed(6)).join(","),b.map(n=>n.toFixed(6)).join(",")].sort().join("|");edges.set(key,`M${a.join(",")}L${b.join(",")}`);if(cell.id&&framed.includes(cell.id))hidden.add(key);}}return [...edges].filter(([key])=>!hidden.has(key)).map(([,path])=>path).join(" ");}
