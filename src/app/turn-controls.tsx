"use client";
export function TurnControls({undoReason,stepReason,endReason,onUndo,onStep,onEnd}:{undoReason:string;stepReason:string;endReason:string;onUndo:()=>void;onStep:()=>void;onEnd:()=>void}){
 return <div className="turn-controls" aria-label="차례 제어">{[
  {label:'되돌리기',reason:undoReason,run:onUndo},{label:'이전 행동으로',reason:stepReason,run:onStep},{label:'턴 종료',reason:endReason,run:onEnd},
 ].map(b=><button key={b.label} type="button" title={b.reason||b.label} disabled={!!b.reason} onClick={b.run}>{b.label}</button>)}</div>;
}
