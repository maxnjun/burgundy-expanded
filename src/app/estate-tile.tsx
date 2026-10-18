"use client";
import { useId } from "react";
import type { Tile } from "../game/types";
import { TileArt } from "./tile-art";
import { estateCenter,estatePoints,estateEdges,ESTATE_RADIUS,ESTATE_HALF_WIDTH } from "./estate-geometry";

export function EstateTile({tile,coord}:{tile:Tile;coord:{q:number;r:number}}){const id=`estate-clip-${useId().replace(/[^a-zA-Z0-9_-]/g,"")}`,{x,y}=estateCenter(coord);return <g data-estate-tile={tile.id} clipPath={`url(#${id})`}><defs><clipPath id={id} clipPathUnits="userSpaceOnUse"><polygon points={estatePoints(coord)}/></clipPath></defs><TileArt tile={tile} estate x={x-ESTATE_HALF_WIDTH} y={y-ESTATE_RADIUS} width={2*ESTATE_HALF_WIDTH} height={2*ESTATE_RADIUS}/></g>;}
export function EstateGrid({cells,legal=[],framed=[]}:{cells:readonly {id:string;coord:{q:number;r:number}}[];legal?:readonly string[];framed?:readonly string[]}){return <g pointerEvents="none" aria-hidden="true"><path data-estate-grid="true" d={estateEdges(cells,framed)} fill="none" stroke="#e7dfbc" strokeWidth="1" vectorEffect="non-scaling-stroke"/>{cells.filter(c=>legal.includes(c.id)).map(c=><polygon key={c.id} points={estatePoints(c.coord,1.5)} fill="none" stroke="#a27a30" strokeWidth="3"/>)}</g>;}
