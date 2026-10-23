// Requirement dice share the common board's face; player dice keep their own colors.
const pips:Record<number,readonly (readonly [number,number])[]> = {
  1:[[0,0]],2:[[-6,-6],[6,6]],3:[[-6,-6],[0,0],[6,6]],
  4:[[-6,-6],[6,-6],[-6,6],[6,6]],5:[[-6,-6],[6,-6],[0,0],[-6,6],[6,6]],
  6:[[-6,-8],[6,-8],[-6,0],[6,0],[-6,8],[6,8]],
};
export function WhiteDie({x=0,y=0,value,size=28}:{x?:number;y?:number;value:number|null;size?:number}){
  return <g data-white-die={value??"none"} aria-hidden="true" pointerEvents="none" transform={`translate(${x} ${y}) scale(${size/28})`}>
    <rect x="-14" y="-14" width="28" height="28" rx="5" fill="#fffbea" stroke="#a99c78"/>
    {value&&pips[value]?pips[value].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.5" fill="#494735"/>):<text y="4" textAnchor="middle">—</text>}
  </g>;
}
