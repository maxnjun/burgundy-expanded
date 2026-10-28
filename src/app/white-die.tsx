// Requirement dice share the common board's face; player dice keep their own colors.
const pips:Record<number,readonly (readonly [number,number])[]> = {
  1:[[0,0]],2:[[-6,-6],[6,6]],3:[[-6,-6],[0,0],[6,6]],
  4:[[-6,-6],[6,-6],[-6,6],[6,6]],5:[[-6,-6],[6,-6],[0,0],[-6,6],[6,6]],
  6:[[-6,-8],[6,-8],[-6,0],[6,0],[-6,8],[6,8]],
};
export function WhiteDie({x=0,y=0,value,size=28,color,pipColor="#494735",raised=false}:{x?:number;y?:number;value:number|null;size?:number;color?:string;pipColor?:string;raised?:boolean}){
  return <g data-white-die={value??"none"} data-die-raised={raised||undefined} aria-hidden="true" pointerEvents="none" transform={`translate(${x} ${y}) scale(${size/28})`}>
    {raised&&<path d="M-9-12H9Q14-12 14-7V12Q14 16 9 16H-9Q-14 16-14 12V-7Q-14-12-9-12" fill="#302516" opacity=".25"/>}
    <rect x="-14" y="-14" width="28" height="28" rx="5" fill={color??"#fffbea"} stroke="#a99c78"/>
    {raised&&<path d="M-10-12H10Q12-12 12-10V-7Q0-11-12-7V-10Q-12-12-10-12" fill="#fff" opacity=".24"/>}
    {value&&pips[value]?pips[value].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="2.5" fill={pipColor}/>):<text y="4" textAnchor="middle">—</text>}
  </g>;
}
