import type {GameAction,GameState} from './types';
import {shieldLayout} from './shields';
import {isCastleAction} from './castle-actions';

export const canEndTurn=(actions:readonly GameAction[])=>actions.some(a=>a.type==='end-turn');
export const canSilverPurchase=(actions:readonly GameAction[])=>actions.some(a=>a.type==='buy-black-tile'||a.type==='extension'&&a.extensionId==='vineyards'&&a.command==='buy');
export const canPurchaseTile=(actions:readonly GameAction[])=>canSilverPurchase(actions)||actions.some(a=>a.type==='use-monastery-six');

function effectGuidance(game:GameState):string {
 const effect=game.turn.pendingEffects[0],choice=game.turn.pendingChoice;
 const p=effect?.payload as {kind?:string;primary?:number;vineChoice?:string;tradeSlotId?:string;vineRewardId?:string}|null;
 if(p?.vineChoice){
  const texts:Record<string,string>={order:'먼저 처리할 포도밭 보너스를 선택하세요.',token:'획득할 포도 보너스 토큰을 선택하세요.','black-get':'무료로 가져올 검은 타일 또는 포도 상점 타일을 선택하세요.','vine-get':'가져올 포도 타일을 선택하세요.'};
  if(texts[p.vineChoice])return texts[p.vineChoice];
 }
 const texts:Record<string,string>={castle:'성의 추가 행동을 선택하세요.','white-castle':`흰 주사위 ${game.dice.whiteDie??'—'}로 수행할 추가 행동을 선택하세요.`,market:'가져올 선박 또는 동물 타일을 선택하세요.','carpenters-workshop':'가져올 건물 타일을 선택하세요.',church:'가져올 성·광산·수도원 타일을 선택하세요.',warehouse:'판매할 상품을 선택하세요.','town-hall':'추가로 배치할 저장고 타일과 영지를 선택하세요.',crane:'복사할 건물 효과를 선택하세요.',ship:p?.primary===undefined?'공용보드에서 상품 보관함을 선택하세요.':'인접 공급처의 상품 보관함을 선택하거나 효과를 건너뛰세요.','shield-five':'추가로 가져올 상품 종류를 선택하거나 효과를 건너뛰세요.','shield-storage':'초과 보관 타일을 선택해 폐기하세요.','shield-phase':shieldLayout(game)?.rules?.phase?.stage==='tribute'?'방패 유지비를 지불하거나 제거할 방패를 선택하세요.':'방패 효과로 무료 배치할 타일과 영지를 선택하세요.'};
 const text=texts[p?.kind??'']??(choice?`${choice.source.section} 효과의 대상을 선택하세요.`:'추가 효과를 처리하고 있습니다.');
 return `${p?.tradeSlotId?'무역로 보상 · ':p?.vineRewardId?'포도밭 보너스 · ':''}${text}`;
}

export interface GuidanceSelection {purchase?:boolean;dieId?:string;tileId?:string|null;vineTileId?:string|null;shieldNumber?:number|null;special?:boolean;replacement?:boolean;goodsTypes?:boolean;computer?:'playing'|'paused'}
/** Display only: legality and effect order always belong to the engine. */
export function actionGuidance(game:GameState,actions:readonly GameAction[],selection:GuidanceSelection={}):string {
 if(game.status==='setup')return '시작 성 타일을 배치할 위치를 선택하세요.';
 if(game.status==='finished')return '게임이 종료되었습니다.';
 const player=game.players.find(p=>p.id===game.turn.activePlayerId);
 if(selection.computer)return `${player?.name??'AI'}의 차례${selection.computer==='paused'?'가 일시정지되었습니다.':'를 진행하고 있습니다.'}`;
 if(selection.replacement)return '교체할 타일 또는 방패를 확인하세요.';
 if(selection.purchase&&canSilverPurchase(actions))return '은화 2개로 구매할 타일을 선택하세요. 남은 보상은 유지됩니다.';
 if(selection.special)return actions.some(a=>a.type==='use-monastery-six')?'수도원 6 · 일꾼 2개로 구매할 번호 공급처 타일을 선택하세요.':'현재 가능한 수도원 6 행동이 없습니다. 선택을 취소하세요.';
 if(selection.goodsTypes)return '가져올 상품 종류를 선택하세요.';
 if(selection.shieldNumber)return `방패 ${selection.shieldNumber}를 장착할 성을 선택하세요.`;
 if((game.turn.pendingChoice||game.turn.pendingEffects.length)&&!isCastleAction(game))return selection.tileId?'타일을 배치할 영지를 선택하세요.':effectGuidance(game);
 if(game.turn.stage==='round-setup')return '라운드를 준비하고 있습니다.';
 if(game.turn.stage==='phase-end')return '';
 if(game.turn.stage!=='player-turn')return '게임 진행을 준비하고 있습니다.';
 if(selection.tileId)return player?.storage.includes(selection.tileId)?'타일을 배치할 영지를 선택하세요.':'교체할 저장고 타일을 선택하세요.';
 if(selection.vineTileId)return '포도 타일을 배치할 포도밭 자리를 선택하세요.';
 if(canEndTurn(actions))return `턴을 종료하시겠습니까?${canPurchaseTile(actions)?' (구매 가능)':''}`;
 if(selection.dieId){
  const intents=actions.flatMap(a=>a.type==='use-die'&&a.dieId===selection.dieId?[a.intent]:[]);
  if(intents.length&&intents.every(i=>i.kind==='take-workers'))return '일꾼 획득 버튼을 누르세요.';
  const die=game.dice.players[player?.id??'']?.find(d=>d.id===selection.dieId);
  return `주사위 ${die?.value??'—'}의 행동 대상을 선택하세요. 공급처·저장고·상품에서 선택할 수 있습니다.`;
 }
 const hasDice=game.dice.players[player?.id??'']?.some(d=>!d.used);
 return isCastleAction(game)?hasDice?'추가 행동 또는 주사위를 선택하세요.':'추가 주사위 행동을 선택하세요.':hasDice?'주사위를 선택하세요.':'남은 필수 행동과 선택을 확인하세요.';
}
