import type {PlayerColor} from "./types";

export const PLAYER_COLORS = ["blue", "red", "green", "yellow", "purple", "pink"] as const;
export const PLAYER_PALETTE = {
  blue: {name:"파랑", fill:"#298dc7", ink:"#1a6089"},
  red: {name:"빨강", fill:"#d6624c", ink:"#973a29"},
  green: {name:"초록", fill:"#83ab65", ink:"#42652a"},
  yellow: {name:"노랑", fill:"#dbbe52", ink:"#705a12"},
  purple: {name:"보라", fill:"#9b72c4", ink:"#67418d"},
  pink: {name:"분홍", fill:"#e18bb4", ink:"#943d67"},
} satisfies Record<PlayerColor, {name:string;fill:string;ink:string}>;
export const isPlayerColor = (value:unknown):value is PlayerColor => PLAYER_COLORS.some(c=>c===value);
// Older saves omit color; retain their original seat palette without rewriting them.
export const playerColorKey = (p:{color?:PlayerColor;seat?:number}):PlayerColor => p.color??PLAYER_COLORS[(p.seat??0)%4];
export const playerPaint = (p:{color?:PlayerColor;seat?:number}) => PLAYER_PALETTE[playerColorKey(p)];
/** Retain selected seats, then give newly visible seats an unused color. */
export function normalizeSeatColors(colors:readonly PlayerColor[]):PlayerColor[]{
 const used=new Set<PlayerColor>();
 return Array.from({length:4},(_,i)=>{const color=colors[i]&&!used.has(colors[i])?colors[i]:PLAYER_COLORS.find(c=>!used.has(c))!;used.add(color);return color;});
}
