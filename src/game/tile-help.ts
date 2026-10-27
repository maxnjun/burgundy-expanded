import type { Tile, BuildingType, MonasteryNumber } from "./types";
import { SHIELD_ABILITIES } from "./shields";
import { MONASTERY_BUILDINGS } from "./core/monasteries";
import beige from "../../public/assets/tiles/beige/final/manifest.json";
import animals from "../../public/assets/tiles/animals/final/manifest.json";
import monasteries from "../../public/assets/tiles/monastery/final/manifest.json";
export const LIVESTOCK_NAMES = {cattle:"소",sheep:"양",pigs:"돼지",chickens:"기니피그",geese:"하프물범"} as const;
export const MONASTERY_HELP: Readonly<Record<number, string>> = {
    29: "종료 때 자신의 영지에 배치한 흰 성(베이지색 건물)마다 4점입니다. 기중기는 해당 건물 하나로 셀 수 있습니다.",
    27: "순서 트랙에서 다른 표식과 겹치면 항상 맨 위에 놓습니다. 다른 표식이 들어와도 유지합니다.",
    28: "게임 도중 은화1개로 일꾼2개를 살 수 있습니다. 주사위를 쓰지 않습니다.",
    1: "같은 도시에서 같은 종류의 건물을 여러 개 지을 수 있습니다.", 2: "단계 종료 때 광산마다 은화와 함께 일꾼 1개를 받습니다.",
    3: "상품 한 묶음을 판매할 때 은화를 1개 대신 2개 받습니다.", 4: "상품 한 묶음을 판매할 때 일꾼 1개를 추가로 받습니다.",
    5: "선박으로 상품을 가져온 공급처에 인접한 공급처 하나에서도 상품을 가져올 수 있습니다.", 6: "차례당 한 번 일꾼 2개로 번호 공급처의 건물 하나를 보관합니다. 주사위를 사용하지 않습니다.",
    7: "가축 득점에 참여한 각 타일에 1점씩 추가합니다.", 8: "일꾼 하나로 주사위 눈을 1칸 또는 2칸 변경할 수 있습니다.",
    9: "건물 배치의 주사위 눈을 무료로 ±1 변경할 수 있습니다.", 10: "선박·가축 배치의 주사위 눈을 무료로 ±1 변경할 수 있습니다.",
    11: "성·광산·수도원 배치의 주사위 눈을 무료로 ±1 변경할 수 있습니다.", 12: "번호 공급처에서 타일을 획득할 때 주사위 눈을 무료로 ±1 변경할 수 있습니다.",
    13: "일꾼 획득 행동을 할 때 은화 1개를 추가로 받습니다.", 14: "일꾼 획득 행동으로 2개 대신 4개를 받습니다.",
    15: "종료 때 판매한 상품의 서로 다른 종류마다 2점입니다.", 16: "종료 때 영지의 창고마다 4점입니다.", 17: "종료 때 영지의 감시탑마다 4점입니다.",
    18: "종료 때 영지의 목공소마다 4점입니다.", 19: "종료 때 영지의 교회마다 4점입니다.", 20: "종료 때 영지의 시장마다 4점입니다.",
    21: "종료 때 영지의 숙소마다 4점입니다.", 22: "종료 때 영지의 은행마다 4점입니다.", 23: "종료 때 영지의 시청마다 4점입니다.",
    24: "종료 때 영지에 있는 서로 다른 가축 종류마다 4점입니다.", 25: "종료 때 판매한 상품 타일마다 1점입니다.", 26: "종료 때 획득한 색상 보너스 타일마다 3점이며, 국경 요새 전체 완성 보너스도 포함합니다.",
};
export function tileHelp(tile: Tile): string {
    if (tile.type === "monastery")
        return MONASTERY_HELP[tile.number];
    if (tile.type === "castle")
        return "원하는 주사위 눈으로 추가 행동을 한 번 얻습니다. 추가 배치의 효과도 이어서 처리합니다.";
    if (tile.type === "ship")
        return "원하는 공급처의 상품을 최대 3종 보관 한도 안에서 가져오고 순서 표식을 한 칸 전진합니다.";
    if (tile.type === "mine")
        return "배치 즉시 자원은 받지 않으며, 각 단계 종료마다 은화 1개를 받습니다.";
    if (tile.type === "livestock")
        return tile.species === "geese" ? "하프물범 2마리와 같은 목초지의 한 가축 종류를 합산합니다. 가장 높은 즉시 점수를 적용합니다. 이후 어느 가축을 놓아도 하프물범을 함께 계산하며, 종료 때 별도 가축 종류로 셉니다." : "이 타일의 가축 수와 같은 목초지에 있는 같은 종류 가축 수를 합산해 득점합니다. 같은 목초지의 하프물범도 포함합니다.";
    if (tile.type !== "building")
        return "";
    return { "white-castle": "건물 칸에 배치합니다. 현재 흰 주사위 눈으로 추가 행동 1회를 합니다. 일꾼 보정은 추가 행동에만 적용하며 흰 주사위는 바꾸지 않습니다.", crane: "일반 건물8종 및 활성화된 흰 성 중 원하는 효과를 즉시 선택합니다. 종료 시 보유한 수도원16~23·29에 대해 건물 한 종류로 간주합니다.", market: "번호 공급처에서 선박 또는 가축 하나를 보관합니다.", "carpenters-workshop": "번호 공급처에서 건물 하나를 보관합니다.", church: "번호 공급처에서 성·광산·수도원 중 하나를 보관합니다.", warehouse: "보유 상품 한 종류를 주사위 없이 전량 판매합니다.", "boarding-house": "일꾼 4개를 받습니다.", bank: "은화 2개를 받습니다.", "town-hall": "보관 중인 타일 하나를 주사위 없이 추가 배치하고 그 효과도 처리합니다.", watchtower: "즉시 4점을 얻습니다." }[tile.building];
}

export type TileHelpKind = Tile["type"] | "shield" | "vineyard" | "trade-route";
export interface TileHelp {
    readonly id: string;
    readonly kind: TileHelpKind;
    readonly number?: number;
    readonly name: string;
    readonly imagePath: string | null;
    readonly summary: string;
    readonly details: string;
    readonly timing: string;
    readonly conditions: string;
    readonly notes?: string;
    readonly tile?: Tile;
}
export const SHIELD_MAINTENANCE = "성에 장착된 동안 적용됩니다. 각 단계 종료(A~E)에 방패마다 은화 1개를 내며, 내지 않으면 그 방패를 제거합니다. 방패 3이 있으면 일꾼 1개로 대신 낼 수 있습니다. 14·15의 무료 배치 → 유지비 → 광산 수입 순서입니다. 미리보기 모드에는 능력·유지비·종료 점수를 적용하지 않습니다.";
const buildingNames: Record<BuildingType, string> = {warehouse:"창고",watchtower:"감시탑","carpenters-workshop":"목공소",church:"교회",market:"시장","boarding-house":"숙소",bank:"은행","town-hall":"시청",crane:"기중기","white-castle":"흰 성"};
const monkDetails: Record<number, string> = {
    1:"같은 도시(연결된 건물 구역)에 같은 종류의 건물을 여러 개 배치할 수 있습니다. 색상·주사위·인접 조건은 유지됩니다.",
    2:"광산마다 은화 수입에 더해 일꾼 1개를 받습니다. 방패 8은 은화만 두 배로 하며 이 일꾼 수는 늘리지 않습니다.",
    3:"상품 한 종류를 전량 판매하는 행동 1회마다 은화를 1개 추가합니다. 창고·추가 행동 판매에도 적용됩니다.",
    4:"상품 한 종류를 판매할 때 일꾼 1개를 추가합니다. 판매한 상품 장수만큼 받는 효과는 아닙니다.",
    5:"첫 공급처의 상품을 받은 뒤 번호상 인접한 공급처(1과 6도 인접) 하나를 추가 선택합니다. 상품 보관 3종류 제한은 각 획득에 적용됩니다.",
    6:"주사위 없이 일꾼 2개를 내고 번호 공급처의 건물 하나를 저장고로 가져옵니다. 저장고가 가득 차면 기존 타일 교체가 필요합니다. 검은 공급처 구매와는 별개의 행동입니다.",
    7:"새로 놓은 타일과 같은 목초지의 같은 가축 및 하프물범 타일 중 득점에 참여한 타일마다 1점을 더합니다. 동물 한 마리마다 1점이 아닙니다.",
    8:"일꾼 1개가 같은 방향으로 눈을 1칸 또는 2칸 보정합니다. 1↔6 순환을 허용합니다. 방패 획득의 두 주사위 보정에도 적용됩니다.",
    9:"건물 배치에 필요한 눈을 무료로 ±1 보정합니다. 더 큰 차이는 일꾼과 조합할 수 있습니다.",
    10:"선박·가축 배치에 필요한 눈을 무료로 ±1 보정합니다. 다른 종류 배치에는 적용하지 않습니다.",
    11:"성·광산·수도원 배치에 필요한 눈을 무료로 ±1 보정합니다. 베이지 흰 성은 건물이므로 9번에 해당합니다.",
    12:"번호 공급처에서 타일을 가져오는 행동의 눈을 무료로 ±1 보정합니다. 배치·판매·검은 구매에는 적용하지 않습니다.",
    13:"일반 주사위뿐 아니라 성 등의 추가 행동으로 같은 ‘일꾼 획득’ 행동을 해도 적용됩니다. 숙소·단계 수입처럼 일꾼을 받는 모든 효과에 적용되는 것은 아닙니다. 14번과 함께라면 일꾼 4개와 은화 1개입니다.",
    14:"일반 주사위·성 추가 행동의 ‘일꾼 획득’에 적용됩니다. 숙소의 일꾼 4개를 8개로 만드는 효과는 아닙니다. 13번의 은화 보상도 함께 받습니다.",
    15:"판매한 상품의 서로 다른 눈(1~6) 개수 ×2점입니다. 남은 상품이나 판매 장수 기준이 아닙니다.",
    24:"영지에 놓은 가축 종류 수 ×4점입니다. 기니피그와 하프물범도 각각 별도 종류로 셉니다. 같은 종류의 타일 여러 장은 한 종류입니다.",
    25:"판매 완료된 상품 타일의 전체 장수마다 1점입니다. 판매 행동 횟수나 서로 다른 종류 수 기준이 아닙니다.",
    26:"획득한 색상 보너스 타일의 개수 ×3점입니다. 현재 엔진은 국경 요새의 전체 색상 완성 보너스도 1개로 포함합니다. 방패 7로 보너스 승점이 두 배가 되어도 개수는 늘지 않습니다.",
    27:"순서 트랙에서 다른 표식과 겹치면 자신의 표식을 맨 위에 유지합니다. 남이 나중에 들어와도 같습니다. 방패 6의 수도원 공유 대상에서 제외됩니다.",
    28:"은화 1개를 내고 일꾼 2개를 받습니다. 현재 엔진은 게임 진행 중 다른 플레이어 차례·필수 선택 중에도 허용하며, 은화가 있으면 반복할 수 있습니다. 검은 타일·여관·포도 상점 구매 횟수를 사용하지 않습니다.",
    29:"영지의 흰 성(베이지 건물)마다 4점입니다. 일반 초록 성은 세지 않습니다. 기중기는 16~23·29 중 보유한 건물 점수 효과 하나에 대해 한 번만 4점으로 계산합니다.",
};
const shieldDetails = [
    ["모든 목초지를 하나로 보고 가축을 득점합니다.","서로 떨어진 목초지의 같은 가축·하프물범도 합산합니다. 지역 완성 판정 자체를 합치지는 않습니다.","가축 배치 시"],
    ["다른 플레이어가 일꾼을 얻을 때 일꾼 1개를 받습니다.","상대가 받은 수량과 관계없이 획득 사건마다 1개입니다. 자기 획득은 제외하며, 이 보상이 다시 보상을 연쇄 발생시키지는 않습니다.","다른 플레이어의 일꾼 획득 시"],
    ["방패 유지비를 은화 대신 일꾼으로 낼 수 있습니다.","각 방패의 은화 1개를 일꾼 1개로 대체할 수 있고 방패 3 자신의 유지비도 포함합니다. 지불하지 않을 방패는 제거합니다.","각 단계 종료 · 유지비"],
    ["저장고의 타일 보관 한도를 없앱니다.","포도 타일은 여전히 2칸을 차지합니다. 이 방패를 잃으면 보관량을 기본 3칸까지 줄이는 필수 폐기를 처리합니다.","장착 중 상시"],
    ["선박 효과 뒤 상품 한 종류를 모든 공급처에서 추가로 받습니다.","보관 가능한 한 종류를 선택해 전 번호 공급처에 있는 그 종류 전체를 받습니다. 3종류 보관 한도는 유지되며 수도원 5 처리 후 적용됩니다.","선박 상품 효과 완료 후"],
    ["다른 플레이어 한 명의 수도원 효과를 공유합니다.","장착 후 자신을 제외한 상대 플레이어를 한 번 선택합니다. 대상의 수도원 효과를 자기 영지·자원에 적용하되 27번은 제외하고 같은 번호를 중복 적용하지 않습니다.","대상 선택 후 · 장착 중"],
    ["새로 얻는 색상 보너스 타일의 승점을 두 배로 받습니다.","이미 받은 보너스에는 소급하지 않습니다. 수도원 26의 보너스 개수는 두 배가 되지 않습니다.","색상 전체 완성 보너스 획득 시"],
    ["광산의 단계 종료 은화 수입을 두 배로 받습니다.","광산마다 은화 2개입니다. 수도원 2로 받는 광산당 일꾼 1개는 두 배가 되지 않습니다.","각 단계 종료 · 광산 수입"],
    ["판매한 상품 타일마다 은화 1개를 받습니다.","판매 묶음의 장수만큼 은화를 받으며, 수도원 3은 판매 1회당 은화 1개를 추가합니다. 예: 상품 3장+수도원 3이면 은화 4개입니다.","상품 판매 시"],
    ["게임 종료 수도원 추가 점수를 두 배로 받습니다.","수도원 15~26·29와 기중기의 해당 건물 추가 점수에 적용됩니다. 게임 중 자원·판매·가축 보상은 두 배로 만들지 않습니다.","게임 종료"],
    ["일반 성의 추가 행동으로 방패를 무료로 획득할 수 있습니다.","번호 공급처의 방패 하나와 자기 영지에 놓인 성을 선택합니다. 주사위·일꾼을 소모하지 않습니다. 기존 방패는 선택한 공급 슬롯으로 즉시 반환되어 다시 획득할 수 있습니다. 흰 성의 흰 주사위 행동에는 적용하지 않습니다.","일반 성의 추가 행동 선택 시"],
    ["상품 판매로 받는 승점을 두 배로 받습니다.","주사위·창고·추가 행동의 상품 판매 모두에 적용됩니다. 은화와 일꾼 보상은 두 배가 되지 않습니다.","상품 판매 시"],
    ["게임 종료에 보유한 방패의 점수를 두 배로 받습니다.","1~6번 기본 12점, 7~12번 8점, 13~18번 4점을 각각 두 배로 합니다. 자기 자신도 포함하고 제거된 방패는 세지 않습니다.","게임 종료"],
    ["단계 종료에 번호 공급처 타일 하나를 영지에 무료 배치합니다.","저장고를 거치거나 주사위를 쓰지 않습니다. 색상·인접·건물 중복 등 배치 조건을 만족해야 하며 타일 효과도 처리합니다. 이후 유지비를 냅니다.","각 단계 종료 · 유지비 전"],
    ["단계 종료에 검은 공급처 타일 하나를 영지에 무료 배치합니다.","검은 공급처에서 직접 배치하며 은화·주사위·턴당 구매 횟수를 쓰지 않습니다. 여관 독립 스택과 포도 상점은 대상이 아닙니다. 합법 배치와 타일 효과 처리 후 유지비를 냅니다.","각 단계 종료 · 유지비 전"],
    ["차례마다 한 번, 미사용 주사위 하나를 원하는 눈으로 바꿉니다.","1~6 중 하나로 무료 변경합니다. 주사위를 사용 처리하지 않으며 이미 사용한 주사위와 흰 주사위는 바꿀 수 없습니다.","자기 차례당 한 번"],
    ["완성 지역의 크기 점수를 한 칸 크게 계산합니다.","단계 보너스·색상 보너스·요새 줄 점수는 늘리지 않습니다. 여관의 +1과 합산하며 실제 칸 수나 지역 연결은 바뀌지 않습니다.","지역 완성 시"],
    ["영지 타일을 기존 타일과 인접하지 않아도 배치할 수 있습니다.","빈칸·지형 색상·주사위 눈·건물 중복 조건은 유지됩니다. 별도 포도밭의 시작·인접 배치 규칙을 없애지는 않습니다.","개인 영지 타일 배치 시"],
] as const;

export function tileHelpId(tile: Tile): string {
    return tile.type === "building" ? `building:${tile.building}` : tile.type === "monastery" ? `monastery:${tile.number}` : tile.type === "livestock" ? `livestock:${tile.species}:${tile.count}` : tile.type;
}
function tileEntry(tile: Tile, name: string, imagePath: string, timing: string, details = "", conditions = "해당 타일이 영지에 배치되어 있어야 합니다."): TileHelp {
    return {id:tileHelpId(tile),kind:tile.type,...(tile.type==="monastery"?{number:tile.number}:{}),name,imagePath,summary:tileHelp(tile),details,timing,conditions,tile};
}
export const TILE_HELP_ENTRIES: readonly TileHelp[] = [
    ...beige.assets.map(a=>{const tile:Tile={id:`help:${a.id}`,type:"building",building:a.buildingType as BuildingType,back:"matching-color"};return tileEntry(tile,buildingNames[tile.building],`/assets/tiles/beige/final/${a.file}`,"배치 즉시",tile.building==="crane"?"기중기의 종료 점수는 여러 수도원이 있어도 한 건물당 한 번만 적용합니다.":"추가 획득은 저장고 공간을, 추가 배치는 일반 배치 조건을 따릅니다. 주사위가 필요한 원래 배치 행동과 효과 행동은 구분됩니다.");}),
    ...animals.assets.map(a=>{const tile:Tile={id:`help:${a.file}`,type:"livestock",species:a.species as Extract<Tile,{type:"livestock"}>["species"],count:a.count as 2|3|4,back:a.species==="geese"?"black":"matching-color"};return tileEntry(tile,`${LIVESTOCK_NAMES[tile.species]} ${tile.count}마리`,`/assets/tiles/animals/final/${a.file}`,"배치 즉시",tile.species==="geese"?"내부 ID geese의 기존 거위 확장 효과를 유지한 하프물범입니다. 기본 공급에 임의로 추가되지 않습니다.":"종류와 마릿수에 따라 같은 목초지의 해당 가축을 다시 합산합니다.");}),
    ...(["castle","mine","ship"] as const).map(type=>tileEntry({id:`help:${type}`,type,back:"matching-color"},{castle:"성",mine:"광산",ship:"선박"}[type],`/tiles/illustrations/${type}.png`,type==="mine"?"각 단계 종료":"배치 즉시",type==="castle"?"추가 행동은 실제 주사위를 소모하지 않습니다. 남은 실제 주사위와 독립 행동의 순서를 선택할 수 있지만 시작한 필수 후속 선택은 완료해야 합니다.":type==="ship"?"선택 공급처에서 보관 가능한 상품 종류의 모든 장을 가져옵니다. 3종류 한도를 넘으면 가져올 종류를 선택합니다.":"방패 유지비 처리 후 수입을 받으며 마지막 E단계에도 수입이 적용됩니다.")),
    ...monasteries.assets.map(a=>{const n=a.number,building=MONASTERY_BUILDINGS[n];return tileEntry({id:`help:monastery:${n}`,type:"monastery",number:n as MonasteryNumber,back:"matching-color"},`${n}번 수도원 타일`,`/assets/tiles/monastery/final/${a.file}`,n===2?"각 단계 종료":n>=15&&n!==27&&n!==28?"게임 종료":n===6?"자기 차례당 한 번":n===28?"게임 진행 중 · 은화가 있으면 반복":"영지에 배치된 동안",monkDetails[n]??`영지에 놓인 ${building?buildingNames[building]:"해당 건물"}마다 4점입니다. 기중기는 보유한 16~23·29 중 한 종류에만 한 번 적용합니다.`,n===29?"흰 성 확장을 사용하며 자기 영지에 이 수도원이 배치되어 있어야 합니다.":"자기 영지에 배치된 효과가 적용됩니다. 방패 6으로 공유할 때는 해당 방패의 조건을 따릅니다.");}),
    ...shieldDetails.map(([summary,details,timing],i)=>({id:`shield:${i+1}`,kind:"shield" as const,number:i+1,name:`${i+1}번 방패 · ${i===5?"선택한 플레이어 수도원 공유":SHIELD_ABILITIES[i]}`,imagePath:null,summary,details,timing,conditions:"방패 규칙을 활성화하고 자신의 성에 장착해야 합니다. 매 단계 종료에 방패당 은화 1개(방패 3은 일꾼 대납 가능)를 내며, 내지 않은 방패는 제거합니다.",notes:i===8?"은화 계산은 프로젝트에서 확정한 U15 처리를 설명합니다.":undefined})),
    {id:"inn",kind:"inn",name:"여관",imagePath:"/tiles/illustrations/inn.png",tile:{id:"help:inn",type:"inn",back:"black"},summary:"모든 지형색에 놓을 수 있으며, 그 지역 완성 크기를 1칸 크게 계산합니다.",details:"단계마다 독립 스택에 1개씩 추가되고 미구매 타일은 이월됩니다. 같은 지역에는 여관 1개만 놓습니다. 여관 자체의 성·선박 등 지형별 효과는 없습니다.",timing:"지역 완성 시",conditions:"은화 2개로 구매하며 검은 타일·포도 상점과 턴당 1회 구매 제한을 공유합니다.",notes:"프로젝트 확정 여관 규칙입니다."},
    {id:"vineyard",kind:"vineyard",name:"포도밭 · 이중 육각형 타일",imagePath:null,summary:"연결된 4층 포도밭에 이중 타일을 놓고 두 칸의 보너스를 순서대로 처리합니다.",details:"24칸·12자리, 첫 배치는 1층이며 이후 인접 배치합니다. 보관 시 2칸을 차지합니다. 각 층 완성 때 남은 보너스 토큰 1개를 선택하며 시작 1개+층 4개로 최대 5개입니다. 층 완성 자체의 승점은 없습니다. 같은 색 연결 영역과 보유 토큰으로 종료 점수를 계산합니다.",timing:"배치·층 완성·게임 종료",conditions:"포도밭 확장 활성화. 상점 은화 2개 구매는 검은 타일·여관과 턴당 1회를 공유합니다.",notes:"공식 완전 재현이 아닌 프로젝트 복원판 v0.2 데이터입니다."},
    {id:"trade-route",kind:"trade-route",name:"무역로",imagePath:null,summary:"주사위로 상품을 직접 판매한 행동마다 경로를 한 칸 진행합니다.",details:"해당 칸과 판매 상품의 종류가 같으면 보상 건물 효과를 선택합니다. 다르면 상품 뒷면으로 기록하고 진행합니다. 보상에서 파생된 추가 판매는 경로를 다시 진행하지 않습니다.",timing:"주사위 상품 판매 시",conditions:"무역로 확장 활성화. 한 번 판매하는 묶음의 장수가 아니라 판매 행동 1회당 1칸입니다.",notes:"프로젝트에서 설계한 경로 데이터를 사용합니다."},
];
const helpById = new Map(TILE_HELP_ENTRIES.map(help=>[help.id,help]));
export function getTileHelp(kindOrId: string, key?: number | string): TileHelp | undefined {
    return helpById.get(key===undefined?kindOrId:`${kindOrId}:${key}`);
}
export const TILE_HELP_CATEGORIES = [
    {kind:"building",name:"건물",icon:"building:warehouse"}, {kind:"livestock",name:"가축",icon:"livestock:pigs:2"},
    {kind:"castle",name:"성",icon:"castle"}, {kind:"mine",name:"광산",icon:"mine"}, {kind:"ship",name:"선박",icon:"ship"},
    {kind:"monastery",name:"수도원",icon:"monastery:13"}, {kind:"shield",name:"방패",icon:"shield:16"},
    {kind:"inn",name:"여관",icon:"inn"}, {kind:"vineyard",name:"포도밭",icon:"vineyard"}, {kind:"trade-route",name:"무역로",icon:"trade-route"},
] as const;
