import {test} from "node:test";import assert from "node:assert/strict";
import {createBoardDraft,redrawBoardSeat,selectDraftBoard,validBoardDraft,chooseAIBoard,draftReady,boardPool} from "../../src/game/board-draft";
import {createPracticeSession} from "../../src/game/practice";
test("range pools contain precisely1–22,23–30,1–30 and draws are unique registered boards",()=>{
 for(const range of ["base","fortress","all"] as const){assert.equal(boardPool(range).length,range==="base"?22:range==="fortress"?8:30);for(let seed=0;seed<20;seed++){const draft=createBoardDraft(["seat-1","seat-2","seat-3","seat-4"],range,`draft:${seed}`);assert.ok(validBoardDraft(draft,draft.seats.map(s=>s.playerId)));assert.deepEqual(createBoardDraft(draft.seats.map(s=>s.playerId),range,`draft:${seed}`),draft);for(const s of draft.seats){assert.equal(s.candidates.length,2);assert.notEqual(s.candidates[0],s.candidates[1]);}}}
});
test("selection survives serialization, changes only own seat, AI selects legal board and game uses choices",()=>{
 let draft=createBoardDraft(["seat-1","seat-2"],"all","choice");const other=draft.seats[1];assert.equal(validBoardDraft({...draft,seats:[...draft.seats].reverse()},["seat-1","seat-2"]),false);draft=selectDraftBoard(draft,"seat-1",draft.seats[0].candidates[1]);assert.deepEqual(draft.seats[1],other);
 assert.throws(()=>selectDraftBoard(draft,"seat-1","forged"));draft=selectDraftBoard(draft,"seat-2",chooseAIBoard(draft.seats[1]));assert.ok(draftReady(draft));assert.ok(validBoardDraft(JSON.parse(JSON.stringify(draft)),["seat-1","seat-2"]));
 for(const n of [2,3,4]){let d=createBoardDraft(Array.from({length:n},(_,i)=>`seat-${i+1}`),"all",`selected-${n}`);for(const seat of d.seats)d=selectDraftBoard(d,seat.playerId,chooseAIBoard(seat));const g=createPracticeSession({names:Array.from({length:n},(_,i)=>`P${i}`),seed:"selected",boardIds:d.seats.map(s=>s.selected!)});assert.deepEqual(g.players.map(p=>p.duchy.boardId),d.seats.map(s=>s.selected));}
 draft=redrawBoardSeat(draft,"seat-1","fortress");assert.equal(draft.seats[0].selected,null);assert.equal(draft.seats[1].selected,other.candidates.includes(draft.seats[1].selected!)?draft.seats[1].selected:null);assert.ok(!draftReady(draft));
});
