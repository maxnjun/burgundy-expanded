import type { SVGProps } from "react";
import type { Tile, TileType } from "../game/types";

export const terrainPaint: Record<TileType, string> = {
  castle: "#247654", ship: "#277f9b", mine: "#8f9188",
  livestock: "#8eaf46", building: "#bca04f", monastery: "#d6bf32",
};
const edge = "50,3 94,28 94,80 50,106 6,80 6,28";

/** Shared SVG tile frame; selected illustrations use the project-provided transparent PNGs. */
export function TileArt({ tile, ...props }: { tile: Tile } & SVGProps<SVGSVGElement>) {
  const building = tile.type === "building" ? tile.building : null;
  const tower = building === "watchtower" || building === "church";
  const illustration = tile.type === "monastery" && (tile.number === 27 || tile.number === 28) ? `/tiles/monastery-${tile.number}.png` : building === "crane" ? "/tiles/crane.png" : tile.type === "livestock" && tile.species === "geese" ? "/tiles/goose.png" : null;
  return <svg viewBox="0 0 100 110" aria-hidden="true" focusable="false" {...props}>
    <polygon points={edge} fill={terrainPaint[tile.type]} stroke="#5d5b36" strokeWidth="2"/>
    <polygon points="50,8 89,31 89,77 50,100 11,77 11,31" fill="none" stroke="#fff7bf" strokeOpacity=".45"/>
    <path d="M11 65Q32 41 60 61T89 60V77L50 100 11 77Z" fill={tile.type === "ship" ? "#44a9b9" : "#b6bf69"} opacity=".6"/>
    {tile.type === "castle" && <g stroke="#554b35" strokeWidth="1.2">
      <ellipse cx="51" cy="80" rx="32" ry="9" fill="#284e31" opacity=".6"/>
      <path d="M23 43 50 28 77 43V72L50 87 23 72Z" fill="#d6c398"/>
      <path d="M50 52 77 38V72L50 87Z" fill="#a89573"/>
      {[25, 58].map((x, i) => <g key={x} transform={`translate(${x} ${i ? 25 : 36})`}><path d="M0 0H18V35L9 40 0 35Z" fill="#e5d2aa"/><path d="M-4 0 9-15 22 0Z" fill="#984c35"/><path d="M7 10H11V19H7Z" fill="#494736"/></g>)}
      <path d="M40 78V62Q47 53 54 62V85" fill="#514d36"/>
    </g>}
    {tile.type === "ship" && <g stroke="#534835" strokeWidth="1.4">
      <path d="M12 76Q24 70 35 77T61 77T88 74M18 86Q36 78 51 85T82 83" fill="none" stroke="#b8e3d4"/>
      <path d="M22 64 49 73 82 58 69 78 45 87 29 79Z" fill="#855333"/>
      <path d="M26 66 49 77 76 64" fill="none" stroke="#d4aa68"/>
      <path d="M49 22V74M45 29 27 62H47Z" fill="#e7d8ac"/>
      <path d="M52 28Q78 36 75 58L52 67Z" fill="#fff0ce"/>
      <path d="M49 20 66 25 49 29Z" fill="#b54835"/>
    </g>}
    {tile.type === "mine" && <g stroke="#514f43" strokeWidth="1.4">
      <path d="M13 73 30 35 44 48 61 23 88 74Z" fill="#b9b5a4"/><path d="M30 35 32 65 44 48M61 23 58 63 75 69" fill="#8c8d80"/>
      <path d="M33 76V52Q50 35 66 52V76Z" fill="#343e37"/>
      <path d="M31 80V49H68V80M29 50H71" fill="none" stroke="#896340" strokeWidth="6"/>
      <path d="M41 78 34 95M58 77 65 95M38 85H61" stroke="#d5c9a1"/>
      <path d="M47 70H72L68 83H51Z" fill="#a58555"/><circle cx="54" cy="85" r="4" fill="#42483e"/><circle cx="66" cy="85" r="4" fill="#42483e"/>
      <path d="M53 70 58 61 63 67 68 60 71 70" fill="#e0dfca"/>
    </g>}
    {!illustration && tile.type === "building" && <g stroke="#63513b" strokeWidth="1.3">
      <ellipse cx="51" cy="80" rx="32" ry="8" fill="#756c3a" opacity=".4"/>
      <path d="M23 48 49 36 78 50V76L49 89 23 76Z" fill="#e6d2a0"/>
      <path d="M49 61 78 49V76L49 89Z" fill="#bca77b"/>
      <path d="M17 49 47 26 83 49 49 65Z" fill={building === "bank" ? "#71847a" : "#a85a3b"}/>
      <path d="M17 49 49 62 83 49M30 41 58 52M40 33 70 45" fill="none" stroke="#dca27a"/>
      <path d="M33 66V78H42V69Z" fill="#4e5a4b"/><path d="M58 69V77L66 73V65Z" fill="#4e5a4b"/>
      {tower && <g><path d="M26 31 38 25 49 31V69L37 75 26 69Z" fill="#e8d6a9"/><path d={building === "church" ? "M23 31 37 12 52 31Z" : "M23 31V23H30V27H35V22H41V27H47V23H52V31Z"} fill="#856a49"/><path d="M35 41H40V52H35Z" fill="#515745"/>{building === "church" && <path d="M37 9V22M32 14H42" stroke="#665334" strokeWidth="2"/>}</g>}
      {building === "market" && <g><path d="M16 62 46 71 46 81 16 72Z" fill="#f3e2b7"/><path d="M17 62 24 64V74L17 72M32 67 39 69V79L32 77" fill="#a24336"/><path d="M19 73V85M44 81V92"/><ellipse cx="29" cy="80" rx="8" ry="4" fill="#c99b3a"/></g>}
      {building === "carpenters-workshop" && <g stroke="#76522f" strokeWidth="5"><path d="M57 81 77 72M58 87 78 78"/><path d="M62 77 68 87" stroke="#d3ae75" strokeWidth="2"/></g>}
      {building === "crane" && <g><path d="M22 84V24M17 27H80M30 27 22 43M72 28V66" fill="none" stroke="#695336" strokeWidth="4"/><path d="M62 66H82V83H62Z" fill="#bc8a47"/><path d="M62 66 82 83M82 66 62 83"/></g>}
      {building === "warehouse" && <g fill="#a57b43"><rect x="17" y="76" width="13" height="11"/><path d="M17 76 30 87M30 76 17 87"/><ellipse cx="73" cy="82" rx="7" ry="9"/><path d="M66 80H80M67 85H79"/></g>}
      {building === "bank" && <g fill="#e8c44f"><ellipse cx="73" cy="82" rx="8" ry="3"/><ellipse cx="73" cy="78" rx="8" ry="3"/><ellipse cx="73" cy="74" rx="8" ry="3"/></g>}
      {building === "boarding-house" && <g><path d="M67 43V23H77V47" fill="#c1a17d"/><path d="M74 20Q66 12 75 7" fill="none" stroke="#f0e2c5" strokeWidth="4"/></g>}
      {building === "town-hall" && <g><path d="M48 27V12M48 13 65 18 48 22" fill="#8d3830"/><circle cx="49" cy="47" r="5" fill="#e9d791"/><path d="M49 43V47L52 49"/></g>}
    </g>}
    {!illustration && tile.type === "livestock" && <g>
      {[[-19,-11],[17,-8],[-14,15],[20,18]].slice(0,tile.count).map(([dx,dy],i) => <g key={i} transform={`translate(${50+dx} ${52+dy})`} stroke="#58603c" strokeWidth="1.1">
        <ellipse cx="0" cy="9" rx="13" ry="4" fill="#4b6d36" opacity=".25"/>
        <path d="M-7 5V13M5 5V13" strokeWidth="2"/>
        <ellipse rx={tile.species === "chickens" ? 7 : 11} ry={tile.species === "sheep" ? 8 : 6} fill={tile.species === "pigs" ? "#e2ac92" : "#eee7ca"}/>
        <ellipse cx="10" cy="-3" rx="5" ry="5" fill={tile.species === "sheep" ? "#685c45" : tile.species === "pigs" ? "#efc1a4" : "#f4ead1"}/>
        {tile.species === "cattle" && <><path d="M-7-3Q0-8 3 1L-3 4Z" fill="#7c6347"/><path d="M8-7 7-11M13-7 15-11"/></>}
        {tile.species === "pigs" && <ellipse cx="14" cy="-1" rx="3" ry="2" fill="#c88979"/>}
        {tile.species === "geese" && <><path d="M7 0Q4-11 10-14Q16-14 13-7L13-2" fill="#fff9e1"/><path d="M13-12 20-10 13-8" fill="#e3a02d"/></>}
        {tile.species === "chickens" && <><path d="M8-7 11-11 14-7" fill="#ad4134"/><path d="M14-3H19L14 0" fill="#d6a23e"/><path d="M-5-1-12-7-9 3" fill="#a66c41"/></>}
        <circle cx="12" cy="-4" r=".9" fill="#29392b"/>
      </g>)}
    </g>}
    {!illustration && tile.type === "monastery" && <g stroke="#74613b" strokeWidth="1.2">
      <path d="M22 62 48 48 79 61V78L51 92 22 78Z" fill="#eee1af"/>
      <path d="M19 61 47 43 83 60 53 77Z" fill="#b28b4a"/>
      <path d="M34 62 49 54 67 62 52 70Z" fill="#858849"/>
      <path d="M24 57V31L38 24 51 32V60L38 67Z" fill="#ede0b1"/>
      <path d="M20 32 38 16 55 32 38 40Z" fill="#a6753c"/>
      <path d="M35 43V51H40V42M59 77V84M69 71V79" fill="#5d6548"/>
      <circle cx="73" cy="29" r="15" fill="#fff0b1" stroke="#8a7135"/><text x="73" y="34" textAnchor="middle" fill="#58452b" stroke="none" fontSize="15" fontWeight="bold">{tile.number}</text>
    </g>}
    {illustration && <image data-tile-art-png={illustration} href={illustration} x="17" y="22" width="66" height="66" preserveAspectRatio="xMidYMid meet"/>}
    {tile.type === "livestock" && <g><circle cx="76" cy="82" r="10" fill="#f2e6b5" stroke="#687348"/><text x="76" y="86" textAnchor="middle" fontSize="13" fontWeight="bold" fill="#425131">{tile.count}</text></g>}
    {tile.back === "black" && <path d="M50 94 55 99 50 104 45 99Z" fill="#252c28" stroke="#e6d6aa" strokeWidth=".7"/>}
  </svg>;
}

export function GoodsArt({ value, ...props }: { value: number } & SVGProps<SVGSVGElement>) {
  const colors = ["", "#795a98", "#9a7549", "#c38c38", "#bf7b8b", "#608568", "#488e9c"];
  return <svg viewBox="0 0 40 40" aria-hidden="true" {...props}><rect x="1" y="1" width="38" height="38" rx="2" fill={colors[value]} stroke="#776044"/><path d="M5 5H35V35H5Z" fill="none" stroke="#fff0cd" opacity=".65"/><path d="M12 13 20 9 29 14V26L21 31 12 26Z" fill="#e5c48a" stroke="#604d37"/><path d="M12 13 21 18 29 14M21 18V31M16 11 25 16V28" fill="none" stroke="#89643d"/><rect x="3" y="25" width="12" height="12" rx="2" fill="#fff5d6"/><text x="9" y="34" textAnchor="middle" fill="#463e31" fontSize="10" fontWeight="bold">{value}</text></svg>;
}
